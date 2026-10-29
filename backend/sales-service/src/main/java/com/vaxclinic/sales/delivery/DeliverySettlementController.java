package com.vaxclinic.sales.delivery;

import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.delivery.DeliveryPartnerDtos.PaymentRequest;
import com.vaxclinic.sales.delivery.DeliveryPartnerDtos.ReconcileRequest;
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

/**
 * Đối soát thu hộ / thanh toán với đối tác giao hàng (phiếu thu / chi Sổ quỹ) và hủy phiếu đối soát.
 * Nghiệp vụ ở {@link DeliverySettlementManageService}.
 */
@RestController
@RequestMapping("/api/delivery-partners")
@PreAuthorize("hasAuthority('sales.perform')")
public class DeliverySettlementController {

    private final DeliverySettlementManageService service;

    public DeliverySettlementController(DeliverySettlementManageService service) {
        this.service = service;
    }

    @PostMapping("/{id}/reconcile")
    public DeliverySettlementService.Result reconcile(@PathVariable UUID id, @Valid @RequestBody ReconcileRequest req,
                                                      @AuthenticationPrincipal Jwt jwt) {
        return service.reconcile(id, req, Actor.of(jwt));
    }

    @PostMapping("/{id}/payments")
    public DeliverySettlementService.Result pay(@PathVariable UUID id, @Valid @RequestBody PaymentRequest req,
                                                @AuthenticationPrincipal Jwt jwt) {
        return service.pay(id, req, Actor.of(jwt));
    }

    @PostMapping("/settlements/{settlementId}/cancel")
    public DeliverySettlementService.Result cancel(@PathVariable UUID settlementId, @AuthenticationPrincipal Jwt jwt) {
        return service.cancel(settlementId, Actor.of(jwt));
    }
}
