package com.vaxclinic.sales.order;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.sales.cashbook.CashbookWriter;
import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.customer.Customer;
import com.vaxclinic.sales.debt.DebtLedger;
import com.vaxclinic.sales.invoice.Invoice;
import org.springframework.jdbc.core.JdbcTemplate;
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
 * - Hủy đơn còn cọc: phiếu chi PC{mã đơn} hoàn tiền cho khách, sổ nợ REFUND (đưa nợ về như trước khi cọc).
 * - Tạo hóa đơn từ đơn: phân bổ các phiếu cọc vào hóa đơn (invoices.paid tăng), đơn → COMPLETED.
 *   Hủy hóa đơn đó: gỡ phân bổ, đơn mở lại "Đã xác nhận", tiền cọc vẫn thuộc đơn.
 */
@Component
public class OrderDepositLedger {

    private final JdbcTemplate jdbc;
    private final CashbookWriter cashbook;
    private final DebtLedger debt;
    private final CustomerOrderRepository orders;

    public OrderDepositLedger(JdbcTemplate jdbc, CashbookWriter cashbook, DebtLedger debt, CustomerOrderRepository orders) {
        this.jdbc = jdbc;
        this.cashbook = cashbook;
        this.debt = debt;
        this.orders = orders;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void receive(CustomerOrder o, Customer c, BigDecimal amount, String method, UUID bankAccountId, Actor actor) {
        Integer n = jdbc.queryForObject("select count(*) from cash_vouchers where source_type = 'ORDER' and source_id = ?"
                + " and voucher_type = 'RECEIPT'", Integer.class, o.getId());
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
    public void refund(CustomerOrder o, String method, Actor actor) {
        if (o.getDeposit().signum() <= 0) {
            return;
        }
        Instant now = Instant.now();
        String code = "PC" + o.getCode();
        var v = CashbookWriter.newVoucher(code, "PAYMENT", fundOf(method), "Chi Tiền trả khách", o.getDeposit());
        fill(v, o, null, now, actor, "Hoàn tiền đặt cọc khi hủy đơn " + o.getCode());
        cashbook.save(v, List.of());
        debt.post(o.getCustomerId(), DebtLedger.DocType.REFUND, o.getId(), code, o.getDeposit(), "Hủy đơn " + o.getCode(), now);
        o.setDeposit(BigDecimal.ZERO);
    }

    /** Kiểm tra trước khi xuất kho cho hóa đơn từ đơn đặt hàng; trả về tiền cọc sẽ trừ vào hóa đơn. */
    public BigDecimal depositForInvoice(UUID orderId, UUID customerId, UUID branchId) {
        CustomerOrder o = orders.findById(orderId)
                .orElseThrow(() -> BusinessException.badRequest("ORDER_NOT_FOUND", "Không tìm thấy đơn đặt hàng"));
        checkInvoiceable(o, customerId, branchId);
        return o.getDeposit();
    }

    /** Trong transaction ghi hóa đơn (hóa đơn đã lưu, đã có phiếu thu TT nếu khách trả thêm). */
    @Transactional(propagation = Propagation.MANDATORY)
    public void attach(UUID orderId, Invoice inv) {
        CustomerOrder o = orders.findForUpdate(orderId).orElseThrow();
        checkInvoiceable(o, inv.getCustomerId(), inv.getBranchId());
        for (Map<String, Object> row : jdbc.queryForList("""
                select v.id, v.amount - coalesce((select sum(a.amount) from voucher_allocations a where a.voucher_id = v.id), 0) remaining
                from cash_vouchers v where v.source_type = 'ORDER' and v.source_id = ? and v.voucher_type = 'RECEIPT'
                  and v.status = 'PAID' order by v.occurred_at""", orderId)) {
            BigDecimal take = ((BigDecimal) row.get("remaining")).min(inv.getTotal().subtract(inv.getPaid()));
            if (take.signum() <= 0) {
                continue;
            }
            jdbc.update("insert into voucher_allocations(voucher_id, invoice_id, amount) values (?,?,?)", row.get("id"), inv.getId(), take);
            inv.setPaid(inv.getPaid().add(take));
        }
        o.setStatus("COMPLETED");
        o.setInvoiceId(inv.getId());
    }

    /** Hủy hóa đơn tạo từ đơn: gỡ phân bổ cọc khỏi hóa đơn, mở lại đơn. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void detach(Invoice inv) {
        BigDecimal allocated = allocatedTo(inv.getId());
        jdbc.update("delete from voucher_allocations where invoice_id = ? and voucher_id in "
                + "(select id from cash_vouchers where source_type = 'ORDER')", inv.getId());
        inv.setPaid(inv.getPaid().subtract(allocated));
        jdbc.update("update customer_orders set status = 'CONFIRMED', invoice_id = null where invoice_id = ?", inv.getId());
    }

    /** Tiền cọc đơn đặt hàng đang phân bổ vào hóa đơn. */
    public BigDecimal allocatedTo(UUID invoiceId) {
        return jdbc.queryForObject("""
                select coalesce(sum(a.amount), 0) from voucher_allocations a join cash_vouchers v on v.id = a.voucher_id
                where a.invoice_id = ? and v.source_type = 'ORDER'""", BigDecimal.class, invoiceId);
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
