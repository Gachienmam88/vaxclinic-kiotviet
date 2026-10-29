package com.vaxclinic.integration.payment;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * SePay: thiết lập (sepay_settings, 1 dòng id = 1, API key đã mã hóa), giao dịch ngân hàng (bank_transactions)
 * và yêu cầu thanh toán QR (payment_requests). Chỉ truy cập DB.
 */
@Repository
public class SePayRepository {

    private final JdbcTemplate jdbc;

    public SePayRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Dòng thiết lập (mọi cột); null khi chưa lưu. */
    public Map<String, Object> findSettings() {
        var rows = jdbc.queryForList("select * from sepay_settings where id = 1");
        return rows.isEmpty() ? null : rows.get(0);
    }

    /** enabled + api_key_enc cho xác thực webhook; null khi chưa lưu. */
    public Map<String, Object> findWebhookAuth() {
        var rows = jdbc.queryForList("select enabled, api_key_enc from sepay_settings where id = 1");
        return rows.isEmpty() ? null : rows.get(0);
    }

    /** apiKeyEnc null = giữ key cũ. */
    public void upsertSettings(boolean enabled, String apiKeyEnc, boolean autoComplete) {
        jdbc.update("""
                insert into sepay_settings(id, enabled, api_key_enc, auto_complete, updated_at) values (1, ?, ?, ?, now())
                on conflict (id) do update set enabled = excluded.enabled, auto_complete = excluded.auto_complete,
                  api_key_enc = coalesce(excluded.api_key_enc, sepay_settings.api_key_enc), updated_at = now()""",
                enabled, apiKeyEnc, autoComplete);
    }

    /** Chống trùng theo sepay_id: trả 1 nếu là giao dịch mới, 0 nếu SePay gửi lại. */
    public int insertBankTransaction(long sepayId, String gateway, String transactionDate, String accountNumber,
                                     String transferType, BigDecimal amount, String content, String referenceCode,
                                     String paymentCode) {
        return jdbc.update("""
                insert into bank_transactions(sepay_id, gateway, transaction_date, account_number, transfer_type, amount, content,
                  reference_code, payment_code) values (?,?,?,?,?,?,?,?,?) on conflict (sepay_id) do nothing""",
                sepayId, gateway, transactionDate, accountNumber, transferType, amount, content, referenceCode, paymentCode);
    }

    /** Cộng tiền vào yêu cầu thanh toán; chuyển PAID khi đã nhận đủ. */
    public void creditPaymentRequest(String code, BigDecimal amount) {
        jdbc.update("""
                update payment_requests set paid_amount = paid_amount + ?,
                  status = case when paid_amount + ? >= amount then 'PAID' else status end,
                  paid_at = case when paid_amount + ? >= amount then now() else paid_at end
                where code = ?""", amount, amount, amount, code);
    }

    public boolean paymentRequestExists(String code) {
        Integer n = jdbc.queryForObject("select count(*) from payment_requests where code = ?", Integer.class, code);
        return n != null && n > 0;
    }

    public void insertPaymentRequest(String code, BigDecimal amount, String reference, UUID branchId, UUID createdBy) {
        jdbc.update("insert into payment_requests(code, amount, reference, branch_id, created_by) values (?,?,?,?,?)",
                code, amount, reference, branchId, createdBy);
    }

    /** code, amount, paid_amount, status, paid_at; null khi không có. */
    public Map<String, Object> findPaymentRequest(String code) {
        var rows = jdbc.queryForList("select code, amount, paid_amount, status, paid_at from payment_requests where code = ?", code);
        return rows.isEmpty() ? null : rows.get(0);
    }

    /** Mới nhất trước. */
    public List<Map<String, Object>> findTransactions(int limit) {
        return jdbc.queryForList("""
                select sepay_id, gateway, transaction_date, account_number, transfer_type, amount, content, reference_code,
                  payment_code, received_at from bank_transactions order by received_at desc limit ?""", limit);
    }
}
