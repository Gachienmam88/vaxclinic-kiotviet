package com.vaxclinic.sales.delivery;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.debt.DebtLedger;
import com.vaxclinic.sales.invoice.Invoice;
import com.vaxclinic.sales.invoice.InvoiceRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * Ghi đổi trạng thái vận đơn (1 transaction, khóa dòng vận đơn, chống 2 người đổi cùng lúc):
 * - Giao thành công: thu hộ = min(COD, tổng − đã trả) → hóa đơn tăng "đã trả", công nợ khách giảm, đối tác nợ cửa hàng (+COD);
 *   phí giao hàng cửa hàng chịu (SHOP) → cửa hàng nợ đối tác (−phí).
 * - Chuyển hoàn (đối tác đang mang hàng về): chỉ đổi trạng thái, chưa nhập kho, chưa ghi phí.
 * - Đã chuyển hoàn (cửa hàng đã nhận lại hàng): phiếu trả hàng đã tạo trước (hàng về kho); phí giao hàng + phí chuyển hoàn
 *   cửa hàng chịu (số nhân viên nhập, mặc định = phí của vận đơn) → cửa hàng nợ đối tác (−phí), tính vào "Phí trả ĐTGH".
 * - Đã hủy (chưa lấy hàng): chỉ hủy vận đơn, hóa đơn giữ nguyên; bỏ khoản thu hộ.
 */
@Component
public class ShipmentStatusWriter {

    private final ShipmentRepository shipments;
    private final InvoiceRepository invoices;
    private final DebtLedger debt;
    private final PartnerLedger ledger;
    private final ShipmentInvoiceHooks hooks;

    public ShipmentStatusWriter(ShipmentRepository shipments, InvoiceRepository invoices, DebtLedger debt, PartnerLedger ledger,
                                ShipmentInvoiceHooks hooks) {
        this.shipments = shipments;
        this.invoices = invoices;
        this.debt = debt;
        this.ledger = ledger;
        this.hooks = hooks;
    }

    @Transactional
    public void apply(UUID id, String from, String to, UUID returnId, ShipmentDtos.ReturnOptions opts, String note, Actor actor) {
        Map<String, Object> s = shipments.lockForUpdate(id);
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
        BigDecimal returnFee = (BigDecimal) s.get("return_fee");
        if (ShipmentStatus.CANCELLED.equals(to)) {
            hooks.markCancelled(id);
            hooks.log(id, from, to, note, actor);
            return;
        }
        if (ShipmentStatus.DELIVERED.equals(to)) {
            codPosted = collectCod(s, now);
            if (feePosted == null && "SHOP".equals(s.get("fee_payer"))) {
                feePosted = fee;
                ledger.post(partnerId, branchId, PartnerLedger.DocType.FEE, id, code, fee.negate(), "Phí giao hàng " + code, now);
            }
        }
        if (ShipmentStatus.RETURNED.equals(to) && feePosted == null) { // vận đơn chuyển hoàn kiểu cũ đã ghi phí thì bỏ qua
            fee = opts.shippingFee() == null ? fee : ShipmentInvoiceHooks.money(opts.shippingFee());
            returnFee = ShipmentInvoiceHooks.money(opts.returnFee());
            feePosted = fee.add(returnFee);
            ledger.post(partnerId, branchId, PartnerLedger.DocType.FEE, id, code, fee.negate(), "Phí giao hàng " + code + " (chuyển hoàn)", now);
            ledger.post(partnerId, branchId, PartnerLedger.DocType.FEE, id, code, returnFee.negate(), "Phí chuyển hoàn " + code, now);
        }
        boolean finished = ShipmentStatus.DELIVERED.equals(to) || ShipmentStatus.RETURNED.equals(to);
        shipments.updateStatus(id, to, returnId, codPosted, feePosted, returnFee, finished, now);
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
