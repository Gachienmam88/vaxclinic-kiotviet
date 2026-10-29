package com.vaxclinic.sales.order;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.sales.cashbook.CashbookRepository;
import com.vaxclinic.sales.cashbook.CashbookWriter;
import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.customer.Customer;
import com.vaxclinic.sales.debt.DebtLedger;
import com.vaxclinic.sales.invoice.Invoice;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/**
 * Tiền đặt cọc của đơn đặt hàng:
 * - Thu cọc: phiếu thu TT{mã đơn}[-n] (nguồn ORDER, không hạch toán doanh thu), sổ nợ PAYMENT (khách trả trước → nợ âm).
 * - Hủy đơn còn cọc: phiếu chi PC{mã đơn} hoàn tiền cho khách, sổ nợ REFUND (đưa nợ về như trước khi cọc);
 *   hoặc giữ cọc làm tiền khách trả trước (không gọi refund: phiếu thu cọc giữ nguyên, nợ khách vẫn âm, đơn giữ số cọc).
 * - Tạo hóa đơn từ đơn: phân bổ các phiếu cọc vào hóa đơn (invoices.paid tăng), đơn → COMPLETED.
 *   Hủy hóa đơn đó: gỡ phân bổ, đơn mở lại "Đã xác nhận", tiền cọc vẫn thuộc đơn.
 */
@Component
public class OrderDepositLedger {

    private final OrderDepositRepository deposits;
    private final CashbookRepository allocations;
    private final CashbookWriter cashbook;
    private final DebtLedger debt;
    private final CustomerOrderRepository orders;
    private final com.vaxclinic.sales.cashbook.CashVoucherRepository vouchers;

    public OrderDepositLedger(OrderDepositRepository deposits, CashbookRepository allocations, CashbookWriter cashbook,
                              DebtLedger debt, CustomerOrderRepository orders, com.vaxclinic.sales.cashbook.CashVoucherRepository vouchers) {
        this.vouchers = vouchers;
        this.deposits = deposits;
        this.allocations = allocations;
        this.cashbook = cashbook;
        this.debt = debt;
        this.orders = orders;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void receive(CustomerOrder o, Customer c, BigDecimal amount, String method, UUID bankAccountId, Actor actor) {
        Integer n = deposits.countReceipts(o.getId());
        String code = "TT" + o.getCode() + (n == null || n == 0 ? "" : "-" + (n + 1));
        Instant now = Instant.now();
        var v = CashbookWriter.newVoucher(code, "RECEIPT", fundOf(method), "Thu Tiền khách trả", amount);
        v.setBankAccountId(bankAccountId);
        fill(v, o, c.getPhone(), now, actor, "Đặt cọc đơn " + o.getCode());
        cashbook.save(v, List.of());
        debt.post(c.getId(), DebtLedger.DocType.PAYMENT, o.getId(), code, amount.negate(), "Đặt cọc đơn " + o.getCode(), now);
        o.setDeposit(o.getDeposit().add(amount));
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void refund(CustomerOrder o, String method, UUID bankAccountId, Actor actor) {
        if (o.getDeposit().signum() <= 0) {
            return;
        }
        Instant now = Instant.now();
        String code = "PC" + o.getCode();
        var v = CashbookWriter.newVoucher(code, "PAYMENT", fundOf(method), "Chi Tiền trả khách", o.getDeposit());
        v.setBankAccountId("TRANSFER".equals(method) || "CARD".equals(method) ? bankAccountId : null);
        fill(v, o, null, now, actor, "Hoàn tiền đặt cọc khi hủy đơn " + o.getCode());
        cashbook.save(v, List.of());
        debt.post(o.getCustomerId(), DebtLedger.DocType.REFUND, o.getId(), code, o.getDeposit(), "Hủy đơn " + o.getCode(), now);
        o.setDeposit(BigDecimal.ZERO);
    }

    /**
     * Hủy các phiếu thu cọc của đơn ("hủy đặt cọc liên quan" / "hủy những phiếu thanh toán liên quan"): phiếu → Đã hủy,
     * công nợ khách tăng lại đúng số cọc (PAYMENT_CANCEL), tiền cọc của đơn về 0. Phiếu đã phân bổ vào hóa đơn còn hiệu lực
     * thì không hủy được (hủy hóa đơn trước).
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public BigDecimal cancelReceipts(CustomerOrder o) {
        BigDecimal total = BigDecimal.ZERO;
        Instant now = Instant.now();
        for (UUID id : deposits.paidReceiptIds(o.getId())) {
            var v = vouchers.findById(id).orElseThrow();
            cashbook.cancel(v);
            debt.post(o.getCustomerId(), DebtLedger.DocType.PAYMENT_CANCEL, v.getId(), v.getCode(), v.getAmount(),
                    "Hủy phiếu cọc " + v.getCode() + " của đơn " + o.getCode(), now);
            total = total.add(v.getAmount());
        }
        o.setDeposit(o.getDeposit().subtract(total).max(BigDecimal.ZERO));
        return total;
    }

    /**
     * Kiểm tra + giữ chỗ đơn cho hóa đơn invoiceId TRƯỚC khi xuất kho (máy khác đang lập hóa đơn cùng đơn → chặn);
     * trả về tiền cọc sẽ trừ vào hóa đơn. Gửi lại cùng invoiceId vẫn qua được.
     */
    public BigDecimal depositForInvoice(UUID orderId, UUID invoiceId, UUID customerId, UUID branchId) {
        CustomerOrder o = orders.findById(orderId)
                .orElseThrow(() -> BusinessException.badRequest("ORDER_NOT_FOUND", "Không tìm thấy đơn đặt hàng"));
        checkInvoiceable(o, customerId, branchId);
        int claimed = deposits.claimForInvoicing(orderId, invoiceId);
        if (claimed == 0) {
            throw BusinessException.conflict("ORDER_BUSY", "Đơn " + o.getCode() + " đang được lập hóa đơn ở máy khác");
        }
        return o.getDeposit();
    }

    /** Lập hóa đơn thất bại → bỏ giữ chỗ để lập lại được ngay. */
    public void releaseClaim(UUID orderId, UUID invoiceId) {
        deposits.releaseClaim(orderId, invoiceId);
    }

    /** Trong transaction ghi hóa đơn (hóa đơn đã lưu, đã có phiếu thu TT nếu khách trả thêm). */
    @Transactional(propagation = Propagation.MANDATORY)
    public void attach(UUID orderId, Invoice inv) {
        CustomerOrder o = orders.findForUpdate(orderId).orElseThrow();
        checkInvoiceable(o, inv.getCustomerId(), inv.getBranchId());
        for (Map<String, Object> row : deposits.receiptRemainders(orderId)) {
            BigDecimal take = ((BigDecimal) row.get("remaining")).min(inv.getTotal().subtract(inv.getPaid()));
            if (take.signum() <= 0) {
                continue;
            }
            allocations.insertAllocation((UUID) row.get("id"), inv.getId(), take);
            inv.setPaid(inv.getPaid().add(take));
        }
        o.setStatus("COMPLETED");
        o.setInvoiceId(inv.getId());
    }

    /**
     * Hủy hóa đơn tạo từ đơn: gỡ phân bổ cọc khỏi hóa đơn, mở lại đơn (Đã xác nhận). cancelReceipts = true ("Hủy thanh toán? →
     * Xác nhận"): hủy luôn các phiếu cọc của đơn (công nợ khách tăng lại); false ("Bỏ qua"): phiếu cọc giữ nguyên, lại là cọc của đơn.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public void detach(Invoice inv, boolean cancelReceipts) {
        BigDecimal allocated = allocatedTo(inv.getId());
        deposits.deleteAllocations(inv.getId());
        inv.setPaid(inv.getPaid().subtract(allocated));
        deposits.reopenByInvoice(inv.getId());
        if (cancelReceipts && inv.getOrderId() != null) {
            orders.findForUpdate(inv.getOrderId()).ifPresent(this::cancelReceipts);
        }
    }

    /** Tiền cọc đơn đặt hàng đang phân bổ vào hóa đơn. */
    public BigDecimal allocatedTo(UUID invoiceId) {
        return deposits.allocatedTo(invoiceId);
    }

    private static void checkInvoiceable(CustomerOrder o, UUID customerId, UUID branchId) {
        if (!o.isOpen()) {
            throw BusinessException.badRequest("ORDER_NOT_OPEN", "Đơn " + o.getCode()
                    + ("COMPLETED".equals(o.getStatus()) ? " đã tạo hóa đơn" : " đã hủy"));
        }
        if (!Objects.equals(o.getCustomerId(), customerId)) {
            throw BusinessException.badRequest("ORDER_CUSTOMER_MISMATCH", "Hóa đơn phải cùng khách hàng với đơn " + o.getCode());
        }
        if (!Objects.equals(o.getBranchId(), branchId)) {
            throw BusinessException.badRequest("ORDER_BRANCH_MISMATCH", "Hóa đơn phải cùng chi nhánh với đơn " + o.getCode());
        }
    }

    private static void fill(com.vaxclinic.sales.cashbook.CashVoucher v, CustomerOrder o, String phone, Instant at,
                             Actor actor, String note) {
        v.setOccurredAt(at);
        v.setBranchId(o.getBranchId());
        v.setPartnerType("CUSTOMER");
        v.setPartnerId(o.getCustomerId());
        v.setPartnerName(o.getCustomerName());
        v.setPartnerPhone(phone);
        v.setCollectorId(actor.id());
        v.setCollectorName(actor.name());
        v.setCreatedBy(actor.id());
        v.setCreatedByName(actor.name());
        v.setAccounting(false); // tiền cọc: doanh thu ghi nhận khi xuất hóa đơn
        v.setAffectsDebt(true);
        v.setSourceType("ORDER");
        v.setSourceId(o.getId());
        v.setNote(note);
    }

    private static String fundOf(String method) {
        return "TRANSFER".equals(method) || "CARD".equals(method) ? "BANK" : "EWALLET".equals(method) ? "EWALLET" : "CASH";
    }
}
