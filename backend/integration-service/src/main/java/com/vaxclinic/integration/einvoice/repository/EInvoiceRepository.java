package com.vaxclinic.integration.einvoice.repository;

import com.vaxclinic.integration.einvoice.client.MisaClient;
import com.vaxclinic.integration.einvoice.dto.EInvoiceDtos.InvoiceStatus;
import com.vaxclinic.integration.einvoice.dto.EInvoiceDtos.RecordStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/** einvoice_settings (1 dòng, id = 1) + einvoice_records (kết quả phát hành theo hóa đơn bán). */
@Repository
public class EInvoiceRepository {

    private final JdbcTemplate jdbc;

    public EInvoiceRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<Map<String, Object>> findSettingsRows() {
        return jdbc.queryForList("select * from einvoice_settings where id = 1");
    }

    public Map<String, Object> getSettings() {
        return jdbc.queryForMap("select * from einvoice_settings where id = 1");
    }

    /** passwordEnc null = giữ mật khẩu cũ. */
    public void upsertSettings(String environment, String appId, String taxCode, String username, String passwordEnc,
                               String invSeries, String invoiceName, boolean sendEmail) {
        jdbc.update("""
                insert into einvoice_settings(id, environment, app_id, tax_code, username, password_enc, inv_series, invoice_name, send_email, updated_at)
                values (1,?,?,?,?,?,?,?,?, now())
                on conflict (id) do update set environment = excluded.environment, app_id = excluded.app_id, tax_code = excluded.tax_code,
                  username = excluded.username, password_enc = coalesce(excluded.password_enc, einvoice_settings.password_enc),
                  inv_series = excluded.inv_series, invoice_name = excluded.invoice_name, send_email = excluded.send_email, updated_at = now()""",
                environment, appId, taxCode, username, passwordEnc, invSeries, invoiceName, sendEmail);
    }

    public List<Map<String, Object>> findRecordRows(UUID invoiceId) {
        return jdbc.queryForList("select * from einvoice_records where invoice_id = ?", invoiceId);
    }

    public Map<String, Object> getRecord(UUID invoiceId) {
        return jdbc.queryForMap("select * from einvoice_records where invoice_id = ?", invoiceId);
    }

    public void insertFailedRecord(UUID invoiceId, String invoiceCode, UUID refId) {
        jdbc.update("insert into einvoice_records(invoice_id, invoice_code, status, ref_id) values (?,?, 'FAILED', ?)",
                invoiceId, invoiceCode, refId);
    }

    public void updateRecordResult(UUID invoiceId, String status, MisaClient.PublishResult r) {
        jdbc.update("""
                update einvoice_records set status = ?, transaction_id = ?, inv_series = ?, inv_no = ?, inv_code = ?, inv_date = ?,
                    error = ?, attempts = attempts + 1, updated_at = now() where invoice_id = ?""",
                status, r.transactionId(), r.invSeries(), r.invNo(), r.invCode(), r.invDate(),
                r.error(), invoiceId);
    }

    /** invoiceIds không rỗng. */
    public List<RecordStatus> findRecordsByInvoiceIds(List<UUID> invoiceIds) {
        String in = String.join(",", invoiceIds.stream().map(id -> "?").toList());
        return jdbc.queryForList("select invoice_id, invoice_code, status, inv_series, inv_no, inv_code, inv_date, transaction_id, error, updated_at"
                + " from einvoice_records where invoice_id in (" + in + ")", invoiceIds.toArray())
                .stream().map(RecordStatus::fromRow).toList();
    }

    public List<InvoiceStatus> statuses() {
        return jdbc.query("select invoice_id, case when status = 'PUBLISHED' and coalesce(inv_code, '') <> '' then 'ACCEPTED'"
                + " else status end st from einvoice_records", (rs, n) -> new InvoiceStatus(rs.getObject(1, UUID.class).toString(),
                rs.getString(2)));
    }

    public boolean isPublished(UUID invoiceId) {
        Integer n = jdbc.queryForObject("select count(*) from einvoice_records where invoice_id = ? and status = 'PUBLISHED'",
                Integer.class, invoiceId);
        return n != null && n > 0;
    }
}
