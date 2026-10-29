package com.vaxclinic.integration.einvoice;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Thiết lập MISA (einvoice_settings, 1 dòng id = 1) và tra cứu kết quả phát hành (einvoice_records) cho API.
 * Chỉ truy cập DB; mật khẩu lưu dạng đã mã hóa (password_enc). Ghi kết quả phát hành nằm ở {@link EInvoiceService}.
 */
@Repository
public class EInvoiceRepository {

    private final JdbcTemplate jdbc;

    public EInvoiceRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Dòng thiết lập (mọi cột); null khi chưa lưu. */
    public Map<String, Object> findSettings() {
        var rows = jdbc.queryForList("select * from einvoice_settings where id = 1");
        return rows.isEmpty() ? null : rows.get(0);
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

    /** Bản ghi phát hành của các hóa đơn (rỗng khi không truyền id nào). */
    public List<Map<String, Object>> findRecordsByInvoiceIds(List<UUID> invoiceIds) {
        if (invoiceIds.isEmpty()) {
            return List.of();
        }
        String in = String.join(",", invoiceIds.stream().map(id -> "?").toList());
        return jdbc.queryForList("select invoice_id, invoice_code, status, inv_series, inv_no, inv_code, inv_date, transaction_id, error, updated_at"
                + " from einvoice_records where invoice_id in (" + in + ")", invoiceIds.toArray());
    }

    /** Mọi bản ghi phát hành: PUBLISHED có mã CQT → ACCEPTED, còn lại giữ nguyên trạng thái. */
    public List<Map<String, Object>> findStatuses() {
        return jdbc.query("select invoice_id, case when status = 'PUBLISHED' and coalesce(inv_code, '') <> '' then 'ACCEPTED'"
                + " else status end st from einvoice_records", (rs, n) -> Map.of("invoiceId", rs.getObject(1, UUID.class).toString(),
                "status", rs.getString(2)));
    }

    public boolean isPublished(UUID invoiceId) {
        Integer n = jdbc.queryForObject("select count(*) from einvoice_records where invoice_id = ? and status = 'PUBLISHED'",
                Integer.class, invoiceId);
        return n != null && n > 0;
    }
}
