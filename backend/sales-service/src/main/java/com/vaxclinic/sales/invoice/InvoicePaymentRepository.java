package com.vaxclinic.sales.invoice;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.UUID;

/** Phiếu thu gắn với hóa đơn: tổng phiếu thu thêm còn hiệu lực, gỡ phân bổ của phiếu TT{mã} khi sửa hóa đơn. */
@Repository
public class InvoicePaymentRepository {

    private final JdbcTemplate jdbc;

    public InvoicePaymentRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Tổng các phiếu thu nguồn sourceType của hóa đơn còn hiệu lực (PAID). */
    public BigDecimal activeTotal(String sourceType, UUID invoiceId) {
        return jdbc.queryForObject("select coalesce(sum(amount), 0) from cash_vouchers where source_type = ? and source_id = ?"
                + " and status = 'PAID'", BigDecimal.class, sourceType, invoiceId);
    }

    /** Xóa phân bổ vào hóa đơn của phiếu thu tự động TT{mã} (nguồn INVOICE). */
    public void deleteAutoAllocations(UUID invoiceId) {
        jdbc.update("delete from voucher_allocations where invoice_id = ? and voucher_id in "
                + "(select id from cash_vouchers where source_type = 'INVOICE' and source_id = ?)", invoiceId, invoiceId);
    }
}
