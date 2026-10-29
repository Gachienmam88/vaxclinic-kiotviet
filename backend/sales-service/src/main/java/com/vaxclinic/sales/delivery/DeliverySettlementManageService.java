package com.vaxclinic.sales.delivery;

import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.delivery.DeliveryPartnerDtos.PaymentRequest;
import com.vaxclinic.sales.delivery.DeliveryPartnerDtos.ReconcileRequest;
import org.springframework.stereotype.Service;

import java.util.UUID;

/** Đối soát / thanh toán / hủy đối soát với đối tác giao hàng ({@link DeliverySettlementService}) rồi ghi lịch sử thao tác. */
@Service
public class DeliverySettlementManageService {

    private static final String FEATURE = "Đối tác giao hàng";

    private final DeliverySettlementService service;
    private final AuditLogger audit;

    public DeliverySettlementManageService(DeliverySettlementService service, AuditLogger audit) {
        this.service = service;
        this.audit = audit;
    }

    public DeliverySettlementService.Result reconcile(UUID partnerId, ReconcileRequest req, Actor actor) {
        var r = service.reconcile(partnerId, req, actor);
        actor.audit(audit, req.branchId(), FEATURE, "Đối soát", r.code(), "Đối soát " + req.shipmentIds().size()
                + " vận đơn, chênh lệch " + Actor.money(r.amount()) + (r.voucherCode() == null ? "" : ", phiếu " + r.voucherCode()));
        return r;
    }

    public DeliverySettlementService.Result pay(UUID partnerId, PaymentRequest req, Actor actor) {
        var r = service.pay(partnerId, req, actor);
        actor.audit(audit, req.branchId(), FEATURE, "Thanh toán", r.code(), ("RECEIPT".equals(req.direction())
                ? "Thu tiền đối tác " : "Chi trả đối tác ") + Actor.money(req.amount()) + ", phiếu " + r.voucherCode());
        return r;
    }

    public DeliverySettlementService.Result cancel(UUID settlementId, Actor actor) {
        var r = service.cancel(settlementId, actor);
        actor.audit(audit, null, FEATURE, "Hủy đối soát", r.code(), "Hủy phiếu " + r.code() + ", số tiền " + Actor.money(r.amount()));
        return r;
    }
}
