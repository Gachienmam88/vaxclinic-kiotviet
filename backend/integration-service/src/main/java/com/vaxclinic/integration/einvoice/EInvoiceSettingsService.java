package com.vaxclinic.integration.einvoice;

import com.vaxclinic.integration.common.SecretCipher;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Thiết lập MISA meInvoice (mật khẩu mã hóa AES-GCM, không bao giờ trả ra) và tra cứu trạng thái HĐĐT cho API.
 * Phát hành nằm ở {@link EInvoiceService}.
 */
@Service
public class EInvoiceSettingsService {

    private final EInvoiceRepository einvoices;
    private final SecretCipher cipher;
    private final EInvoiceService publisher;
    private final MisaClient misa;

    public EInvoiceSettingsService(EInvoiceRepository einvoices, SecretCipher cipher, EInvoiceService publisher, MisaClient misa) {
        this.einvoices = einvoices;
        this.cipher = cipher;
        this.publisher = publisher;
        this.misa = misa;
    }

    /** Không bao giờ trả mật khẩu; chỉ báo đã có hay chưa. */
    public Map<String, Object> settings() {
        var s = einvoices.findSettings();
        if (s == null) {
            return Map.of("configured", false, "environment", "TEST", "invoiceName", "Hóa đơn bán hàng");
        }
        var out = new HashMap<String, Object>();
        out.put("configured", s.get("password_enc") != null);
        out.put("environment", s.get("environment"));
        out.put("appId", s.get("app_id"));
        out.put("taxCode", s.get("tax_code"));
        out.put("username", s.get("username"));
        out.put("invSeries", s.get("inv_series"));
        out.put("invoiceName", s.get("invoice_name"));
        out.put("sendEmail", s.get("send_email"));
        return out;
    }

    /** Lưu thiết lập; để trống mật khẩu = giữ mật khẩu cũ. */
    public Map<String, Object> save(EInvoiceController.SettingsRequest r) {
        String enc = r.password() == null || r.password().isBlank() ? null : cipher.encrypt(r.password());
        einvoices.upsertSettings(r.environment() == null ? "TEST" : r.environment(), r.appId().trim(), r.taxCode().trim(),
                r.username().trim(), enc, r.invSeries().trim().toUpperCase(), r.invoiceName().trim(), r.sendEmail());
        return settings();
    }

    /** Thử đăng nhập MISA bằng thiết lập đã lưu. */
    public Map<String, Object> test() {
        misa.token(publisher.account());
        return Map.of("ok", true);
    }

    public List<Map<String, Object>> byInvoices(List<UUID> invoiceIds) {
        return einvoices.findRecordsByInvoiceIds(invoiceIds);
    }

    public List<Map<String, Object>> statuses() {
        return einvoices.findStatuses();
    }

    public Map<String, Object> published(UUID invoiceId) {
        return Map.of("published", einvoices.isPublished(invoiceId));
    }
}
