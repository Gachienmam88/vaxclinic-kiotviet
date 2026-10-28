package com.vaxclinic.sales.delivery;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.sales.cashbook.CashVoucherRepository;
import com.vaxclinic.sales.cashbook.CashbookWriter;
import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.common.SalesRules;
import com.vaxclinic.sales.delivery.DeliveryPartnerDtos.PaymentRequest;
import com.vaxclinic.sales.delivery.DeliveryPartnerDtos.ReconcileRequest;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
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

    private final NamedParameterJdbcTemplate jdbc;
    private final CashbookWriter cashbook;
    private final CashVoucherRepository vouchers;
    private final PartnerLedger ledger;
    private final SalesRules rules;

    public DeliverySettlementService(NamedParameterJdbcTemplate jdbc, CashbookWriter cashbook, CashVoucherRepository vouchers,
                                     PartnerLedger ledger, SalesRules rules) {
        this.jdbc = jdbc;
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
        var rows = jdbc.queryForList("select * from shipments where id in (:ids) for update",
                new MapSqlParameterSource("ids", req.shipmentIds()));
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
            cod = cod.add(DeliveryPartnerQuery.nz((BigDecimal) s.get("cod_posted")));
            fee = fee.add(DeliveryPartnerQuery.nz((BigDecimal) s.get("fee_posted")));
        }
        Result r = settle(partnerId, req.branchId(), "RECONCILE", cod, fee, cod.subtract(fee), rows.size(), req.fund(),
                req.bankAccountId(), req.note(), actor);
        jdbc.update("update shipments set settlement_id = :sid, updated_at = now() where id in (:ids)",
                new MapSqlParameterSource("sid", r.id()).addValue("ids", req.shipmentIds()));
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
        var rows = jdbc.queryForList("select * from delivery_settlements where id = :id for update",
                new MapSqlParameterSource("id", settlementId));
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
        var p = new MapSqlParameterSource("id", settlementId);
        jdbc.update("update delivery_settlements set status = 'CANCELLED', cancelled_at = now() where id = :id", p);
        jdbc.update("update shipments set settlement_id = null, updated_at = now() where settlement_id = :id", p);
        ledger.post((UUID) d.get("partner_id"), branchId, PartnerLedger.DocType.SETTLEMENT_CANCEL, settlementId,
                (String) d.get("code"), amount, "Hủy phiếu " + d.get("code"), Instant.now());
        return r;
    }

    private Result settle(UUID partnerId, UUID branchId, String kind, BigDecimal cod, BigDecimal fee, BigDecimal amount,
                          int count, String fund, UUID bankAccountId, String note, Actor actor) {
        var partners = jdbc.queryForList("select name, phone from delivery_partners where id = :id",
                new MapSqlParameterSource("id", partnerId));
        if (partners.isEmpty()) {
            throw DeliveryPartnerService.notFound();
        }
        UUID id = UUID.randomUUID();
        String code = "DS%06d".formatted(jdbc.getJdbcTemplate().queryForObject("select nextval('delivery_settlement_code_seq')", Long.class));
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
            v.setPartnerName((String) partners.get(0).get("name"));
            v.setPartnerPhone((String) partners.get(0).get("phone"));
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
        jdbc.update("""
                insert into delivery_settlements(id, code, partner_id, branch_id, kind, cod_total, fee_total, amount, shipment_count,
                    voucher_id, note, created_by, created_by_name) values (:id, :code, :partner, :branch, :kind, :cod, :fee, :amount,
                    :count, :voucher, :note, :by, :byName)""", new MapSqlParameterSource("id", id).addValue("code", code)
                .addValue("partner", partnerId).addValue("branch", branchId).addValue("kind", kind).addValue("cod", cod)
                .addValue("fee", fee).addValue("amount", amount).addValue("count", count).addValue("voucher", voucherId)
                .addValue("note", Actor.blankToNull(note)).addValue("by", actor.id()).addValue("byName", actor.name()));
        ledger.post(partnerId, branchId, PartnerLedger.DocType.SETTLEMENT, id, code, amount.negate(),
                "RECONCILE".equals(kind) ? "Đối soát " + count + " vận đơn" : "RECEIPT".equals(kind) ? "Đối tác thanh toán" : "Trả tiền đối tác", now);
        return new Result(id, code, voucherCode, amount);
    }
}
