package com.vaxclinic.integration.einvoice;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.integration.common.SecretCipher;
import com.vaxclinic.integration.einvoice.SalesInvoiceClient.SalesInvoice;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;

/**
 * Phát hành hóa đơn điện tử cho 1 hóa đơn bán:
 * lấy dữ liệu từ sales-service (/internal) → dựng payload MISA → gọi MISA → lưu kết quả (einvoice_records).
 * Thử lại dùng LẠI RefID cũ → MISA chống trùng; đã PUBLISHED thì không gửi nữa.
 */
@Service
public class EInvoiceService {

    private final JdbcTemplate jdbc;
    private final SecretCipher cipher;
    private final MisaClient misa;
    private final SalesInvoiceClient sales;

    public EInvoiceService(JdbcTemplate jdbc, SecretCipher cipher, MisaClient misa, SalesInvoiceClient sales) {
        this.jdbc = jdbc;
        this.cipher = cipher;
        this.misa = misa;
        this.sales = sales;
    }

    public MisaClient.Account account() {
        var rows = jdbc.queryForList("select * from einvoice_settings where id = 1");
        Map<String, Object> s = rows.isEmpty() ? Map.of() : rows.get(0);
        if (s.get("app_id") == null || s.get("password_enc") == null || s.get("inv_series") == null) {
            throw BusinessException.badRequest("EINVOICE_NOT_CONFIGURED",
                    "Chưa thiết lập kết nối MISA meInvoice (Thiết lập → Hóa đơn điện tử)");
        }
        return new MisaClient.Account((String) s.get("environment"), (String) s.get("app_id"), (String) s.get("tax_code"),
                (String) s.get("username"), cipher.decrypt((String) s.get("password_enc")));
    }

    public Map<String, Object> publish(UUID invoiceId) {
        var existing = jdbc.queryForList("select * from einvoice_records where invoice_id = ?", invoiceId);
        if (!existing.isEmpty() && "PUBLISHED".equals(existing.get(0).get("status"))) {
            return existing.get(0);
        }
        MisaClient.Account account = account(); // trước: báo "chưa thiết lập" rõ ràng khi chưa có dòng cấu hình
        var settings = jdbc.queryForMap("select * from einvoice_settings where id = 1");
        SalesInvoice inv = sales.invoice(invoiceId);
        if (inv == null || !"COMPLETED".equals(inv.status())) {
            throw BusinessException.badRequest("INVOICE_NOT_PUBLISHABLE", "Chỉ phát hành được hóa đơn đã hoàn thành");
        }
        UUID refId = existing.isEmpty() ? UUID.randomUUID() : (UUID) existing.get(0).get("ref_id");
        if (existing.isEmpty()) {
            jdbc.update("insert into einvoice_records(invoice_id, invoice_code, status, ref_id) values (?,?, 'FAILED', ?)",
                    invoiceId, inv.code(), refId);
        }
        var b = inv.buyer();
        var source = new MisaInvoicePayload.Source(inv.code(), inv.soldAt(), inv.paymentMethod(), inv.discount(), inv.total(),
                b.code(), b.fullName(), b.legalName(), b.taxCode(), b.address(), b.email(), b.phone(),
                inv.lines().stream().map(l -> new MisaInvoicePayload.SourceLine(l.productCode(), l.productName(), l.unitName(),
                        l.quantity(), l.unitPrice(), l.discount() == null ? BigDecimal.ZERO : l.discount(), l.taxCode())).toList());
        var payload = MisaInvoicePayload.build(source, refId, (String) settings.get("inv_series"),
                (String) settings.get("invoice_name"), Boolean.TRUE.equals(settings.get("send_email")));
        MisaClient.PublishResult r;
        try {
            r = misa.publish(account, payload);
        } catch (BusinessException e) {
            r = new MisaClient.PublishResult(false, null, null, null, null, null, e.getMessage());
        }
        jdbc.update("""
                update einvoice_records set status = ?, transaction_id = ?, inv_series = ?, inv_no = ?, inv_code = ?, inv_date = ?,
                    error = ?, attempts = attempts + 1, updated_at = now() where invoice_id = ?""",
                r.ok() ? "PUBLISHED" : "FAILED", r.transactionId(), r.invSeries(), r.invNo(), r.invCode(), r.invDate(),
                r.error(), invoiceId);
        return jdbc.queryForMap("select * from einvoice_records where invoice_id = ?", invoiceId);
    }
}
