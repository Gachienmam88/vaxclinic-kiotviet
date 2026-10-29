package com.vaxclinic.integration.notification;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Tra cứu cho cảnh báo tích hợp ({@link IntegrationAlertJob}): HĐĐT phát hành lỗi, chuyển khoản SePay khớp mã thanh toán. Chỉ truy cập DB. */
@Repository
public class IntegrationAlertRepository {

    /** Hóa đơn phát hành HĐĐT lỗi. */
    public record FailedEInvoice(UUID invoiceId, String invoiceCode, String error) {
    }

    /** Giao dịch chuyển khoản khớp yêu cầu thanh toán (branchId theo yêu cầu thanh toán). */
    public record MatchedTransfer(long sepayId, BigDecimal amount, String gateway, String content, String paymentCode,
                                  Instant receivedAt, UUID branchId) {
    }

    private final JdbcTemplate jdbc;

    public IntegrationAlertRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Cập nhật cũ nhất trước. */
    public List<FailedEInvoice> failedEInvoices() {
        return jdbc.query("""
                select invoice_id, invoice_code, error, attempts from einvoice_records where status = 'FAILED'
                order by updated_at""", (rs, i) -> new FailedEInvoice(rs.getObject("invoice_id", UUID.class),
                rs.getString("invoice_code"), rs.getString("error")));
    }

    /** SePay đã bật (chưa có dòng thiết lập → false). */
    public boolean sepayEnabled() {
        Boolean enabled = jdbc.query("select enabled from sepay_settings where id = 1",
                rs -> rs.next() ? rs.getBoolean(1) : Boolean.FALSE);
        return Boolean.TRUE.equals(enabled);
    }

    /** Tối đa 500 giao dịch nhận sau {@code since}, cũ nhất trước. */
    public List<MatchedTransfer> matchedTransfersSince(Instant since) {
        return jdbc.query("""
                select t.sepay_id, t.amount, t.gateway, t.content, t.payment_code, t.received_at, p.branch_id
                from bank_transactions t join payment_requests p on p.code = t.payment_code
                where t.received_at > ? order by t.received_at limit 500""", (rs, i) -> new MatchedTransfer(rs.getLong("sepay_id"),
                rs.getBigDecimal("amount"), rs.getString("gateway"), rs.getString("content"), rs.getString("payment_code"),
                rs.getTimestamp("received_at").toInstant(), rs.getObject("branch_id", UUID.class)), Timestamp.from(since));
    }
}
