package com.vaxclinic.sales.delivery;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.sales.cashbook.CashVoucherRepository;
import com.vaxclinic.sales.cashbook.CashbookWriter;
import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.common.SalesRules;
import com.vaxclinic.sales.delivery.DeliveryPartnerDtos.PaymentRequest;
import com.vaxclinic.sales.delivery.DeliveryPartnerDtos.ReconcileRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Đối soát / thanh toán với đối tác giao hàng → phiếu thu/chi Sổ quỹ (nguồn DELIVERY, không hạch toán, không công nợ khách)
 * + sổ công nợ đối tác. amount > 0: đối tác trả cửa hàng (phiếu thu PT{DS}), < 0: cửa hàng trả đối tác (phiếu chi PC{DS}).
 */
@Service
public class DeliverySettlementService {

    public record Result(UUID id, String code, String voucherCode, BigDecimal amount) {
    }

    private final DeliverySettlementRepository settlements;
    private final DeliveryPartnerRepository partners;
    private final CashbookWriter cashbook;
    private final CashVoucherRepository vouchers;
    private final PartnerLedger ledger;
    private final SalesRules rules;

    public DeliverySettlementService(DeliverySettlementRepository settlements, DeliveryPartnerRepository partners,
                                     CashbookWriter cashbook, CashVoucherRepository vouchers, PartnerLedger ledger, SalesRules rules) {
        this.settlements = settlements;
        this.partners = partners;
        this.cashbook = cashbook;
        this.vouchers = vouchers;
        this.ledger = ledger;
        this.rules = rules;
    }

    /** Đối soát các vận đơn đã kết thúc: chênh lệch = Σ thu hộ − Σ phí giao hàng cửa hàng chịu. */
    @Transactional
    public Result reconcile(UUID partnerId, ReconcileRequest req, Actor actor) {
        actor.checkBranch(req.branchId());
        rules.checkNotLocked(req.branchId(), Instant.now());
        var rows = settlements.lockShipments(req.shipmentIds());
        if (rows.size() != req.shipmentIds().stream().distinct().count()) {
            throw BusinessException.badRequest("SHIPMENT_NOT_FOUND", "Có vận đơn không tồn tại");
        }
        BigDecimal cod = BigDecimal.ZERO;
        BigDecimal fee = BigDecimal.ZERO;
        for (var s : rows) {
            boolean ok = partnerId.equals(s.get("partner_id")) && req.branchId().equals(s.get("branch_id"))
                    && s.get("settlement_id") == null && List.of("DELIVERED", "RETURNED").contains((String) s.get("status"));
            if (!ok) {
                throw BusinessException.badRequest("SHIPMENT_NOT_RECONCILABLE", "Vận đơn " + s.get("code")
                        + " không thuộc đối tác / chi nhánh, chưa kết thúc hoặc đã đối soát");
            }
            cod = cod.add(DeliveryPartnerRepository.nz((BigDecimal) s.get("cod_posted")));
            fee = fee.add(DeliveryPartnerRepository.nz((BigDecimal) s.get("fee_posted")));
        }
        Result r = settle(partnerId, req.branchId(), "RECONCILE", cod, fee, cod.subtract(fee), rows.size(), req.fund(),
                req.bankAccountId(), req.note(), actor);
        settlements.attachShipments(r.id(), req.shipmentIds());
        return r;
    }

    /** Thanh toán tự do (nút "Thanh toán" ở đối tác): thu tiền đối tác nợ / chi trả phí cho đối tác. */
    @Transactional
    public Result pay(UUID partnerId, PaymentRequest req, Actor actor) {
        actor.checkBranch(req.branchId());
        rules.checkNotLocked(req.branchId(), Instant.now());
        BigDecimal amount = ShipmentInvoiceHooks.money(req.amount());
        return settle(partnerId, req.branchId(), req.direction(), BigDecimal.ZERO, BigDecimal.ZERO,
                "RECEIPT".equals(req.direction()) ? amount : amount.negate(), 0, req.fund(), req.bankAccountId(), req.note(), actor);
    }

    /** Hủy phiếu đối soát / thanh toán: hủy phiếu Sổ quỹ, đảo sổ công nợ đối tác, vận đơn quay lại chờ đối soát. */
    @Transactional
    public Result cancel(UUID settlementId, Actor actor) {
        var rows = settlements.lock(settlementId);
        if (rows.isEmpty()) {
            throw BusinessException.notFound("SETTLEMENT_NOT_FOUND", "Không tìm thấy phiếu đối soát");
        }
        Map<String, Object> d = rows.get(0);
        UUID branchId = (UUID) d.get("branch_id");
        BigDecimal amount = (BigDecimal) d.get("amount");
        Result r = new Result(settlementId, (String) d.get("code"), null, amount);
        if ("CANCELLED".equals(d.get("status"))) {
            return r;
        }
        actor.checkBranch(branchId);
        rules.checkNotLocked(branchId, ((java.sql.Timestamp) d.get("created_at")).toInstant());
        if (d.get("voucher_id") != null) {
            vouchers.findById((UUID) d.get("voucher_id")).ifPresent(cashbook::cancel);
        }
        settlements.cancel(settlementId);
        ledger.post((UUID) d.get("partner_id"), branchId, PartnerLedger.DocType.SETTLEMENT_CANCEL, settlementId,
                (String) d.get("code"), amount, "Hủy phiếu " + d.get("code"), Instant.now());
        return r;
    }

    private Result settle(UUID partnerId, UUID branchId, String kind, BigDecimal cod, BigDecimal fee, BigDecimal amount,
                          int count, String fund, UUID bankAccountId, String note, Actor actor) {
        var contact = partners.contact(partnerId);
        if (contact.isEmpty()) {
            throw DeliveryPartnerService.notFound();
        }
        UUID id = UUID.randomUUID();
        String code = "DS%06d".formatted(settlements.nextCodeNumber());
        Instant now = Instant.now();
        UUID voucherId = null;
        String voucherCode = null;
        if (amount.signum() != 0) {
            boolean receipt = amount.signum() > 0;
            var v = CashbookWriter.newVoucher((receipt ? "PT" : "PC") + code, receipt ? "RECEIPT" : "PAYMENT",
                    fund == null ? "CASH" : fund, receipt ? "Thu tiền đối tác giao hàng" : "Chi tiền đối tác giao hàng", amount.abs());
            v.setBankAccountId(bankAccountId);
            v.setOccurredAt(now);
            v.setBranchId(branchId);
            v.setPartnerType("DELIVERY_PARTNER");
            v.setPartnerId(partnerId);
            v.setPartnerName((String) contact.get(0).get("name"));
            v.setPartnerPhone((String) contact.get(0).get("phone"));
            v.setCollectorId(actor.id());
            v.setCollectorName(actor.name());
            v.setCreatedBy(actor.id());
            v.setCreatedByName(actor.name());
            v.setAccounting(false); // thu hộ là tiền hàng đã có doanh thu; phí giao hàng tính theo sổ đối tác (báo cáo tài chính)
            v.setAffectsDebt(false);
            v.setSourceType("DELIVERY");
            v.setSourceId(id);
            v.setNote(Actor.blankToNull(note) == null ? ("RECONCILE".equals(kind) ? "Đối soát " + count + " vận đơn" : null) : note.trim());
            var saved = cashbook.save(v, List.of());
            voucherId = saved.getId();
            voucherCode = saved.getCode();
        }
        settlements.insert(id, code, partnerId, branchId, kind, cod, fee, amount, count, voucherId, Actor.blankToNull(note),
                actor.id(), actor.name());
        ledger.post(partnerId, branchId, PartnerLedger.DocType.SETTLEMENT, id, code, amount.negate(),
                "RECONCILE".equals(kind) ? "Đối soát " + count + " vận đơn" : "RECEIPT".equals(kind) ? "Đối tác thanh toán" : "Trả tiền đối tác", now);
        return new Result(id, code, voucherCode, amount);
    }
}
