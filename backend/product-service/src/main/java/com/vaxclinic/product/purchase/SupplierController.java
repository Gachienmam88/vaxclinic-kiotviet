package com.vaxclinic.product.purchase;

import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.product.purchase.PurchaseDtos.Actor;
import com.vaxclinic.product.purchase.SupplierCommandService.SupplierRequest;
import com.vaxclinic.product.purchase.SupplierListQuery.SupplierPage;
import com.vaxclinic.product.purchase.SupplierListQuery.SupplierRow;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Nhà cung cấp: xem cần catalog.view, thêm/sửa/ngừng hoạt động/xóa/import cần inventory.manage (thủ kho, quản lý). */
@RestController
@RequestMapping("/api/suppliers")
@PreAuthorize("hasAuthority('catalog.view')")
public class SupplierController {

    public record NoteRequest(String note) {
    }

    public record StatusRequest(boolean active) {
    }

    private final SupplierCommandService commands;
    private final SupplierListQuery query;
    private final SupplierImportService importer;
    private final AuditLogger audit;

    public SupplierController(SupplierCommandService commands, SupplierListQuery query, SupplierImportService importer,
                              AuditLogger audit) {
        this.commands = commands;
        this.query = query;
        this.importer = importer;
        this.audit = audit;
    }

    /** buyFrom/buyTo: Tổng mua (giá trị); from/to: thời gian tính Tổng mua; debtFrom/debtTo: Nợ hiện tại;
     *  docCode: NCC có phiếu công nợ (PCN/CKN/DCN…) đúng mã này — link sâu từ mã phiếu. */
    @GetMapping
    public SupplierPage search(@RequestParam(defaultValue = "") String q, @RequestParam(required = false) UUID groupId,
                               @RequestParam(required = false) Boolean active,
                               @RequestParam(required = false) BigDecimal buyFrom, @RequestParam(required = false) BigDecimal buyTo,
                               @RequestParam(required = false) Instant from, @RequestParam(required = false) Instant to,
                               @RequestParam(required = false) BigDecimal debtFrom, @RequestParam(required = false) BigDecimal debtTo,
                               @RequestParam(required = false) String docCode,
                               @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "15") int size) {
        return query.search(new SupplierListQuery.Filter(q, groupId, active, buyFrom, buyTo, from, to, debtFrom, debtTo,
                docCode, Math.max(page, 0), Math.min(Math.max(size, 1), 100)));
    }

    @GetMapping("/{id}")
    public SupplierRow get(@PathVariable UUID id) {
        return query.one(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('inventory.manage')")
    public SupplierRow create(@Valid @RequestBody SupplierRequest req, @AuthenticationPrincipal Jwt jwt) {
        Supplier s = commands.create(req, actor(jwt));
        log(jwt, "Thêm mới", s, "Tạo nhà cung cấp " + s.getCode() + " - " + s.getName());
        return query.one(s.getId());
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('inventory.manage')")
    public SupplierRow update(@PathVariable UUID id, @Valid @RequestBody SupplierRequest req, @AuthenticationPrincipal Jwt jwt) {
        Supplier s = commands.update(id, req);
        log(jwt, "Sửa", s, "Sửa nhà cung cấp " + s.getCode() + " - " + s.getName());
        return query.one(id);
    }

    @PatchMapping("/{id}/note")
    @PreAuthorize("hasAuthority('inventory.manage')")
    public SupplierRow note(@PathVariable UUID id, @RequestBody NoteRequest req, @AuthenticationPrincipal Jwt jwt) {
        Supplier s = commands.setNote(id, req.note());
        log(jwt, "Sửa", s, "Sửa ghi chú nhà cung cấp " + s.getCode());
        return query.one(id);
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAuthority('inventory.manage')")
    public SupplierRow status(@PathVariable UUID id, @RequestBody StatusRequest req, @AuthenticationPrincipal Jwt jwt) {
        Supplier s = commands.setActive(id, req.active());
        log(jwt, "Sửa", s, (req.active() ? "Cho phép hoạt động" : "Ngừng hoạt động") + " nhà cung cấp " + s.getCode());
        return query.one(id);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAuthority('inventory.manage')")
    public void delete(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        Supplier s = commands.delete(id);
        log(jwt, "Xóa", s, "Xóa nhà cung cấp " + s.getCode() + " - " + s.getName());
    }

    /** Import file CSV / XLSX: cập nhật theo mã NCC, thêm mới nếu mã chưa có / để trống. Lỗi trả theo từng dòng. */
    @PostMapping("/import")
    @PreAuthorize("hasAuthority('inventory.manage')")
    public SupplierImportService.ImportResult importFile(@RequestParam("file") MultipartFile file,
                                                         @AuthenticationPrincipal Jwt jwt) {
        var result = importer.importFile(file, actor(jwt));
        audit.record(UUID.fromString(jwt.getSubject()), jwt.getClaimAsString("name"), null, "Nhà cung cấp", "Import", null,
                "Import nhà cung cấp từ file " + file.getOriginalFilename() + ": thêm " + result.created() + ", cập nhật "
                        + result.updated() + ", lỗi " + result.errors().size());
        return result;
    }

    static Actor actor(Jwt jwt) {
        List<String> branches = jwt.getClaimAsStringList("branches");
        return new Actor(UUID.fromString(jwt.getSubject()), jwt.getClaimAsString("name"), branches == null ? List.of() : branches);
    }

    private void log(Jwt jwt, String action, Supplier s, String detail) {
        audit.record(UUID.fromString(jwt.getSubject()), jwt.getClaimAsString("name"), s.getBranchId(), "Nhà cung cấp", action,
                s.getCode(), detail);
    }
}
