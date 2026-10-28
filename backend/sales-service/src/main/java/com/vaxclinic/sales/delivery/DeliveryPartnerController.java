package com.vaxclinic.sales.delivery;

import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.delivery.DeliveryPartnerDtos.LedgerRow;
import com.vaxclinic.sales.delivery.DeliveryPartnerDtos.PartnerListResponse;
import com.vaxclinic.sales.delivery.DeliveryPartnerDtos.PartnerRequest;
import com.vaxclinic.sales.delivery.DeliveryPartnerDtos.PartnerRow;
import com.vaxclinic.sales.delivery.DeliveryPartnerDtos.ReconcileRow;
import com.vaxclinic.sales.delivery.DeliveryPartnerDtos.SettlementRow;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/** Đối tác giao hàng: danh sách / thêm / sửa / xóa, sổ công nợ, lịch sử thanh toán, vận đơn chờ đối soát. */
@RestController
@RequestMapping("/api/delivery-partners")
@PreAuthorize("hasAuthority('sales.perform') or hasAuthority('report.view')")
public class DeliveryPartnerController {

    private static final String FEATURE = "Đối tác giao hàng";

    private final DeliveryPartnerService service;
    private final DeliveryPartnerQuery query;
    private final AuditLogger audit;

    public DeliveryPartnerController(DeliveryPartnerService service, DeliveryPartnerQuery query, AuditLogger audit) {
        this.service = service;
        this.query = query;
        this.audit = audit;
    }

    @GetMapping
    public PartnerListResponse list(@RequestParam(required = false) String q, @RequestParam(required = false) Boolean active,
                                    @RequestParam(required = false) String debt, @RequestParam(defaultValue = "0") int page,
                                    @RequestParam(defaultValue = "15") int size) {
        return query.list(q, active, debt, Math.max(page, 0), Math.min(Math.max(size, 1), 200));
    }

    @GetMapping("/{id}")
    public PartnerRow get(@PathVariable UUID id) {
        return query.get(id);
    }

    @GetMapping("/{id}/ledger")
    public List<LedgerRow> ledger(@PathVariable UUID id) {
        query.get(id);
        return query.ledger(id);
    }

    @GetMapping("/{id}/settlements")
    public List<SettlementRow> settlements(@PathVariable UUID id) {
        return query.settlements(id);
    }

    /** Vận đơn chờ đối soát trong các chi nhánh người dùng được làm việc (branchId: lọc 1 chi nhánh). */
    @GetMapping("/{id}/reconcilable")
    public List<ReconcileRow> reconcilable(@PathVariable UUID id, @RequestParam(required = false) UUID branchId,
                                           @AuthenticationPrincipal Jwt jwt) {
        var allowed = Actor.of(jwt).branchIds().stream().map(UUID::fromString).toList();
        return query.reconcilable(id, branchId == null ? allowed : allowed.stream().filter(branchId::equals).toList());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('sales.perform')")
    public PartnerRow create(@Valid @RequestBody PartnerRequest req, @AuthenticationPrincipal Jwt jwt) {
        PartnerRow r = query.get(service.create(req, Actor.of(jwt)));
        Actor.of(jwt).audit(audit, null, FEATURE, "Tạo", r.code(), "Tạo đối tác giao hàng " + r.code() + " " + r.name());
        return r;
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('sales.perform')")
    public PartnerRow update(@PathVariable UUID id, @Valid @RequestBody PartnerRequest req, @AuthenticationPrincipal Jwt jwt) {
        service.update(id, req);
        PartnerRow r = query.get(id);
        Actor.of(jwt).audit(audit, null, FEATURE, "Sửa", r.code(), "Cập nhật đối tác giao hàng " + r.code() + " " + r.name()
                + (r.active() ? "" : " (ngừng hoạt động)"));
        return r;
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAuthority('sales.perform')")
    public void delete(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        String code = service.delete(id);
        Actor.of(jwt).audit(audit, null, FEATURE, "Xóa", code, "Xóa đối tác giao hàng " + code);
    }
}
