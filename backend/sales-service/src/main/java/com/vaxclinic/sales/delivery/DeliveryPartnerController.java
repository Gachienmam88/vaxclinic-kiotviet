package com.vaxclinic.sales.delivery;

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

/**
 * Đối tác giao hàng: danh sách / thêm / sửa / xóa, sổ công nợ, lịch sử thanh toán, vận đơn chờ đối soát.
 * Nghiệp vụ ở {@link DeliveryPartnerManageService}.
 */
@RestController
@RequestMapping("/api/delivery-partners")
@PreAuthorize("hasAuthority('sales.perform') or hasAuthority('report.view')")
public class DeliveryPartnerController {

    private final DeliveryPartnerManageService service;

    public DeliveryPartnerController(DeliveryPartnerManageService service) {
        this.service = service;
    }

    @GetMapping
    public PartnerListResponse list(@RequestParam(required = false) String q, @RequestParam(required = false) Boolean active,
                                    @RequestParam(required = false) String debt, @RequestParam(defaultValue = "0") int page,
                                    @RequestParam(defaultValue = "15") int size) {
        return service.list(q, active, debt, page, size);
    }

    /** Lịch sử đối soát của mọi đối tác (tab "Lịch sử đối soát"). */
    @GetMapping("/settlements")
    public List<DeliveryPartnerDtos.SettlementListRow> allSettlements(@RequestParam(defaultValue = "0") int page,
                                                                      @RequestParam(defaultValue = "50") int size) {
        return service.allSettlements(page, size);
    }

    @GetMapping("/{id}")
    public PartnerRow get(@PathVariable UUID id) {
        return service.get(id);
    }

    @GetMapping("/{id}/ledger")
    public List<LedgerRow> ledger(@PathVariable UUID id) {
        return service.ledger(id);
    }

    @GetMapping("/{id}/settlements")
    public List<SettlementRow> settlements(@PathVariable UUID id) {
        return service.settlements(id);
    }

    /** Vận đơn chờ đối soát trong các chi nhánh người dùng được làm việc (branchId: lọc 1 chi nhánh). */
    @GetMapping("/{id}/reconcilable")
    public List<ReconcileRow> reconcilable(@PathVariable UUID id, @RequestParam(required = false) UUID branchId,
                                           @AuthenticationPrincipal Jwt jwt) {
        return service.reconcilable(id, branchId, Actor.of(jwt));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('sales.perform')")
    public PartnerRow create(@Valid @RequestBody PartnerRequest req, @AuthenticationPrincipal Jwt jwt) {
        return service.create(req, Actor.of(jwt));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('sales.perform')")
    public PartnerRow update(@PathVariable UUID id, @Valid @RequestBody PartnerRequest req, @AuthenticationPrincipal Jwt jwt) {
        return service.update(id, req, Actor.of(jwt));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAuthority('sales.perform')")
    public void delete(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        service.delete(id, Actor.of(jwt));
    }
}
