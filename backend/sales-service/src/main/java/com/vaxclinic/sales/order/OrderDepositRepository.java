package com.vaxclinic.sales.order;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Phiếu cọc đơn đặt hàng (cash_vouchers nguồn ORDER) + phân bổ vào hóa đơn + giữ chỗ lập hóa đơn của đơn. */
@Repository
public class OrderDepositRepository {

    private final JdbcTemplate jdbc;

    public OrderDepositRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Số phiếu thu cọc đã có của đơn (đặt hậu tố mã -n). */
    public Integer countReceipts(UUID orderId) {
        return jdbc.queryForObject("select count(*) from cash_vouchers where source_type = 'ORDER' and source_id = ?"
                + " and voucher_type = 'RECEIPT'", Integer.class, orderId);
    }

    /** Giữ chỗ đơn cho hóa đơn invoiceId (chỗ giữ cũ quá 2 phút bị thay); trả về số dòng đã giữ (0 = máy khác đang giữ). */
    public int claimForInvoicing(UUID orderId, UUID invoiceId) {
        return jdbc.update("""
                update customer_orders set invoicing_id = ?, invoicing_at = now()
                where id = ? and status in ('DRAFT', 'CONFIRMED')
                  and (invoicing_id is null or invoicing_id = ? or invoicing_at < now() - interval '2 minutes')""",
                invoiceId, orderId, invoiceId);
    }

    public void releaseClaim(UUID orderId, UUID invoiceId) {
        jdbc.update("update customer_orders set invoicing_id = null where id = ? and invoicing_id = ?", orderId, invoiceId);
    }

    /** Phiếu thu cọc còn hiệu lực của đơn kèm số chưa phân bổ (id, remaining), cũ trước. */
    public List<Map<String, Object>> receiptRemainders(UUID orderId) {
        return jdbc.queryForList("""
                select v.id, v.amount - coalesce((select sum(a.amount) from voucher_allocations a where a.voucher_id = v.id), 0) remaining
                from cash_vouchers v where v.source_type = 'ORDER' and v.source_id = ? and v.voucher_type = 'RECEIPT'
                  and v.status = 'PAID' order by v.occurred_at""", orderId);
    }

    /** Phiếu thu cọc còn hiệu lực của đơn (để hủy cùng đơn / cùng hóa đơn). */
    public List<UUID> paidReceiptIds(UUID orderId) {
        return jdbc.queryForList("""
                select id from cash_vouchers where source_type = 'ORDER' and source_id = ? and voucher_type = 'RECEIPT'
                  and status = 'PAID' order by occurred_at""", UUID.class, orderId);
    }

    /** Gỡ phân bổ của các phiếu cọc khỏi hóa đơn. */
    public void deleteAllocations(UUID invoiceId) {
        jdbc.update("delete from voucher_allocations where invoice_id = ? and voucher_id in "
                + "(select id from cash_vouchers where source_type = 'ORDER')", invoiceId);
    }

    /** Đơn của hóa đơn mở lại "Đã xác nhận", bỏ liên kết hóa đơn + giữ chỗ. */
    public void reopenByInvoice(UUID invoiceId) {
        jdbc.update("update customer_orders set status = 'CONFIRMED', invoice_id = null, invoicing_id = null where invoice_id = ?", invoiceId);
    }

    /** Tiền cọc đơn đặt hàng đang phân bổ vào hóa đơn. */
    public BigDecimal allocatedTo(UUID invoiceId) {
        return jdbc.queryForObject("""
                select coalesce(sum(a.amount), 0) from voucher_allocations a join cash_vouchers v on v.id = a.voucher_id
                where a.invoice_id = ? and v.source_type = 'ORDER'""", BigDecimal.class, invoiceId);
    }
}
