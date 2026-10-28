package com.vaxclinic.sales.delivery;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.debt.DebtLedger;
import com.vaxclinic.sales.invoice.Invoice;
import com.vaxclinic.sales.invoice.InvoiceRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * Ghi đổi trạng thái vận đơn (1 transaction, khóa dòng vận đơn, chống 2 người đổi cùng lúc):
 * - Giao thành công: thu hộ = min(COD, tổng − đã trả) → hóa đơn tăng "đã trả", công nợ khách giảm, đối tác nợ cửa hàng (+COD);
 *   phí giao hàng cửa hàng chịu (SHOP) → cửa hàng nợ đối tác (−phí).
 * - Chuyển hoàn / Đã chuyển hoàn: phiếu trả hàng đã tạo trước (hàng về kho); người nhận không nhận hàng nên phí giao hàng
 *   luôn do cửa hàng chịu (−phí).
 */
@Component
public class ShipmentStatusWriter {

    private final JdbcTemplate jdbc;
    private final InvoiceRepository invoices;
    private final DebtLedger debt;
    private final PartnerLedger ledger;
    private final ShipmentInvoiceHooks hooks;

    public ShipmentStatusWriter(JdbcTemplate jdbc, InvoiceRepository invoices, DebtLedger debt, PartnerLedger ledger,
                                ShipmentInvoiceHooks hooks) {
        this.jdbc = jdbc;
        this.invoices = invoices;
        this.debt = debt;
        this.ledger = ledger;
        this.hooks = hooks;
    }

    @Transactional
    public void apply(UUID id, String from, String to, UUID returnId, String note, Actor actor) {
        Map<String, Object> s = jdbc.queryForMap("select * from shipments where id = ? for update", id);
        if (!from.equals(s.get("status"))) {
            throw BusinessException.conflict("SHIPMENT_CHANGED", "Vận đơn " + s.get("code") + " vừa được cập nhật, hãy tải lại");
        }
        Instant now = Instant.now();
        UUID partnerId = (UUID) s.get("partner_id");
        UUID branchId = (UUID) s.get("branch_id");
        String code = (String) s.get("code");
        BigDecimal codPosted = (BigDecimal) s.get("cod_posted");
        BigDecimal feePosted = (BigDecimal) s.get("fee_posted");
        BigDecimal fee = (BigDecimal) s.get("shipping_fee");
        if (ShipmentStatus.DELIVERED.equals(to)) {
            codPosted = collectCod(s, now);
        }
        boolean shopPaysFee = ShipmentStatus.returning(to) || "SHOP".equals(s.get("fee_payer"));
        if (feePosted == null && shopPaysFee && (ShipmentStatus.DELIVERED.equals(to) || ShipmentStatus.returning(to))) {
            feePosted = fee;
            ledger.post(partnerId, branchId, PartnerLedger.DocType.FEE, id, code, fee.negate(), "Phí giao hàng " + code, now);
        }
        boolean finished = ShipmentStatus.DELIVERED.equals(to) || ShipmentStatus.RETURNED.equals(to);
        jdbc.update("""
                update shipments set status = ?, return_id = coalesce(?, return_id), cod_posted = ?, fee_posted = ?,
                    delivered_at = case when ? then ? else delivered_at end, updated_at = now() where id = ?""",
                to, returnId, codPosted, feePosted, finished, Timestamp.from(now), id);
        hooks.log(id, from, to, note, actor);
    }

    /** Ghi nhận tiền thu hộ đối tác đã thu của người nhận. */
    private BigDecimal collectCod(Map<String, Object> s, Instant now) {
        Invoice inv = invoices.findForUpdate((UUID) s.get("invoice_id")).orElseThrow();
        if (!"COMPLETED".equals(inv.getStatus())) {
            throw BusinessException.badRequest("INVOICE_NOT_COMPLETED", "Hóa đơn " + inv.getCode() + " đã hủy");
        }
        String code = (String) s.get("code");
        BigDecimal cod = ((BigDecimal) s.get("cod_amount")).min(inv.getTotal().subtract(inv.getPaid())).max(BigDecimal.ZERO);
        if (cod.signum() == 0) {
            return cod;
        }
        inv.setPaid(inv.getPaid().add(cod)); // khách đã trả qua đối tác (chưa về quỹ: chờ đối soát)
        if (inv.getCustomerId() != null) {
            debt.post(inv.getCustomerId(), DebtLedger.DocType.PAYMENT, (UUID) s.get("id"), code, cod.negate(),
                    "Thu hộ qua đối tác giao hàng", now);
        }
        ledger.post((UUID) s.get("partner_id"), (UUID) s.get("branch_id"), PartnerLedger.DocType.COD, (UUID) s.get("id"), code,
                cod, "Thu hộ " + code + " / " + inv.getCode(), now);
        return cod;
    }
}
