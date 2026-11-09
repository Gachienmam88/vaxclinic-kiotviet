package com.vaxclinic.sales.delivery.controller;

import com.vaxclinic.sales.delivery.dto.DeliveryPartnerDtos;
import com.vaxclinic.sales.delivery.service.DeliverySettlementService;
import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.delivery.dto.DeliveryPartnerDtos.PaymentRequest;
import com.vaxclinic.sales.delivery.dto.DeliveryPartnerDtos.ReconcileRequest;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/** Đối soát thu hộ / thanh toán với đối tác giao hàng (phiếu thu / chi Sổ quỹ) và hủy phiếu đối soát. */
@RestController
@RequestMapping("/api/delivery-partners")
@PreAuthorize("hasAuthority('sales.perform')")
public class DeliverySettlementController {

    private static final String FEATURE = "Đối tác giao hàng";

    private final DeliverySettlementService service;
    private final AuditLogger audit;

    public DeliverySettlementController(DeliverySettlementService service, AuditLogger audit) {
        this.service = service;
        this.audit = audit;
    }

    @PostMapping("/{id}/reconcile")
    public DeliverySettlementService.Result reconcile(@PathVariable UUID id, @Valid @RequestBody ReconcileRequest req,
                                                      @AuthenticationPrincipal Jwt jwt) {
        Actor actor = Actor.of(jwt);
        var r = service.reconcile(id, req, actor);
        actor.audit(audit, req.branchId(), FEATURE, "Đối soát", r.code(), "Đối soát " + req.shipmentIds().size()
                + " vận đơn, chênh lệch " + Actor.money(r.amount()) + (r.voucherCode() == null ? "" : ", phiếu " + r.voucherCode()));
        return r;
    }

    @PostMapping("/{id}/payments")
    public DeliverySettlementService.Result pay(@PathVariable UUID id, @Valid @RequestBody PaymentRequest req,
                                                @AuthenticationPrincipal Jwt jwt) {
        Actor actor = Actor.of(jwt);
        var r = service.pay(id, req, actor);
        actor.audit(audit, req.branchId(), FEATURE, "Thanh toán", r.code(), ("RECEIPT".equals(req.direction())
                ? "Thu tiền đối tác " : "Chi trả đối tác ") + Actor.money(req.amount()) + ", phiếu " + r.voucherCode());
        return r;
    }

    @PostMapping("/settlements/{settlementId}/cancel")
    public DeliverySettlementService.Result cancel(@PathVariable UUID settlementId, @AuthenticationPrincipal Jwt jwt) {
        Actor actor = Actor.of(jwt);
        var r = service.cancel(settlementId, actor);
        actor.audit(audit, null, FEATURE, "Hủy đối soát", r.code(), "Hủy phiếu " + r.code() + ", số tiền " + Actor.money(r.amount()));
        return r;
    }
}
