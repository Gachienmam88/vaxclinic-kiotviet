package com.vaxclinic.product.purchase;

import com.vaxclinic.product.purchase.PurchaseDtos.Actor;
import com.vaxclinic.product.purchase.SupplierCommandService.SupplierRequest;
import com.vaxclinic.product.purchase.SupplierListRepository.SupplierPage;
import com.vaxclinic.product.purchase.SupplierListRepository.SupplierRow;
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
import java.util.UUID;

/**
 * Nhà cung cấp: xem cần catalog.view, thêm/sửa/ngừng hoạt động/xóa/import cần inventory.manage (thủ kho, quản lý).
 * Nghiệp vụ ở {@link SupplierManageService}.
 */
@RestController
@RequestMapping("/api/suppliers")
@PreAuthorize("hasAuthority('catalog.view')")
public class SupplierController {

    public record NoteRequest(String note) {
    }

    public record StatusRequest(boolean active) {
    }

    private final SupplierManageService service;

    public SupplierController(SupplierManageService service) {
        this.service = service;
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
        return service.search(new SupplierListRepository.Filter(q, groupId, active, buyFrom, buyTo, from, to, debtFrom, debtTo,
                docCode, Math.max(page, 0), Math.min(Math.max(size, 1), 100)));
    }

    @GetMapping("/{id}")
    public SupplierRow get(@PathVariable UUID id) {
        return service.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('inventory.manage')")
    public SupplierRow create(@Valid @RequestBody SupplierRequest req, @AuthenticationPrincipal Jwt jwt) {
        return service.create(req, Actor.of(jwt));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('inventory.manage')")
    public SupplierRow update(@PathVariable UUID id, @Valid @RequestBody SupplierRequest req, @AuthenticationPrincipal Jwt jwt) {
        return service.update(id, req, Actor.of(jwt));
    }

    @PatchMapping("/{id}/note")
    @PreAuthorize("hasAuthority('inventory.manage')")
    public SupplierRow note(@PathVariable UUID id, @RequestBody NoteRequest req, @AuthenticationPrincipal Jwt jwt) {
        return service.setNote(id, req.note(), Actor.of(jwt));
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAuthority('inventory.manage')")
    public SupplierRow status(@PathVariable UUID id, @RequestBody StatusRequest req, @AuthenticationPrincipal Jwt jwt) {
        return service.setActive(id, req.active(), Actor.of(jwt));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAuthority('inventory.manage')")
    public void delete(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        service.delete(id, Actor.of(jwt));
    }

    /** Import file CSV / XLSX: cập nhật theo mã NCC, thêm mới nếu mã chưa có / để trống. Lỗi trả theo từng dòng. */
    @PostMapping("/import")
    @PreAuthorize("hasAuthority('inventory.manage')")
    public SupplierImportService.ImportResult importFile(@RequestParam("file") MultipartFile file,
                                                         @AuthenticationPrincipal Jwt jwt) {
        return service.importFile(file, Actor.of(jwt));
    }
}
