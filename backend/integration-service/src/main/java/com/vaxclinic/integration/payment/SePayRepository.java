package com.vaxclinic.integration.payment;

import com.vaxclinic.integration.payment.SePayDtos.Webhook;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** sepay_settings (1 dòng, id = 1), payment_requests, bank_transactions. */
@Repository
public class SePayRepository {

    private final JdbcTemplate jdbc;

    public SePayRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<Map<String, Object>> findSettingsRows() {
        return jdbc.queryForList("select * from sepay_settings where id = 1");
    }

    /** apiKeyEnc null = giữ key cũ. */
    public void upsertSettings(boolean enabled, String apiKeyEnc, boolean autoComplete) {
        jdbc.update("""
                insert into sepay_settings(id, enabled, api_key_enc, auto_complete, updated_at) values (1, ?, ?, ?, now())
                on conflict (id) do update set enabled = excluded.enabled, auto_complete = excluded.auto_complete,
                  api_key_enc = coalesce(excluded.api_key_enc, sepay_settings.api_key_enc), updated_at = now()""",
                enabled, apiKeyEnc, autoComplete);
    }

    public List<Map<String, Object>> findWebhookSettingsRows() {
        return jdbc.queryForList("select enabled, api_key_enc from sepay_settings where id = 1");
    }

    public boolean paymentRequestExists(String code) {
        Integer n = jdbc.queryForObject("select count(*) from payment_requests where code = ?", Integer.class, code);
        return n != null && n > 0;
    }

    /** @return 1 nếu là giao dịch mới, 0 nếu SePay gửi lại cùng id */
    public int insertBankTransaction(Webhook w, String paymentCode) {
        return jdbc.update("""
                insert into bank_transactions(sepay_id, gateway, transaction_date, account_number, transfer_type, amount, content,
                  reference_code, payment_code) values (?,?,?,?,?,?,?,?,?) on conflict (sepay_id) do nothing""",
                w.id(), w.gateway(), w.transactionDate(), w.accountNumber(), w.transferType(), w.transferAmount(),
                w.content() == null ? null : w.content().substring(0, Math.min(500, w.content().length())), w.referenceCode(), paymentCode);
    }

    public void addPaidAmount(String code, BigDecimal amount) {
        jdbc.update("""
                update payment_requests set paid_amount = paid_amount + ?,
                  status = case when paid_amount + ? >= amount then 'PAID' else status end,
                  paid_at = case when paid_amount + ? >= amount then now() else paid_at end
                where code = ?""", amount, amount, amount, code);
    }

    public void insertPaymentRequest(String code, BigDecimal amount, String reference, UUID branchId, UUID createdBy) {
        jdbc.update("insert into payment_requests(code, amount, reference, branch_id, created_by) values (?,?,?,?,?)",
                code, amount, reference, branchId, createdBy);
    }

    public List<Map<String, Object>> findPaymentRequestRows(String code) {
        return jdbc.queryForList("select code, amount, paid_amount, status, paid_at from payment_requests where code = ?", code);
    }

    public List<Map<String, Object>> transactions(int limit) {
        return jdbc.queryForList("""
                select sepay_id, gateway, transaction_date, account_number, transfer_type, amount, content, reference_code,
                  payment_code, received_at from bank_transactions order by received_at desc limit ?""", limit);
    }
}
