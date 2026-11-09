package com.vaxclinic.integration.einvoice;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.integration.common.SecretCipher;
import com.vaxclinic.integration.einvoice.EInvoiceDtos.InvoiceStatus;
import com.vaxclinic.integration.einvoice.EInvoiceDtos.RecordStatus;
import com.vaxclinic.integration.einvoice.EInvoiceDtos.SettingsRequest;
import com.vaxclinic.integration.einvoice.SalesInvoiceClient.SalesInvoice;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Phát hành hóa đơn điện tử cho 1 hóa đơn bán:
 * lấy dữ liệu từ sales-service (/internal) → dựng payload MISA → gọi MISA → lưu kết quả (einvoice_records).
 * Thử lại dùng LẠI RefID cũ → MISA chống trùng; đã PUBLISHED thì không gửi nữa.
 */
@Service
public class EInvoiceService {

    private final EInvoiceRepository repo;
    private final SecretCipher cipher;
    private final MisaClient misa;
    private final SalesInvoiceClient sales;

    public EInvoiceService(EInvoiceRepository repo, SecretCipher cipher, MisaClient misa, SalesInvoiceClient sales) {
        this.repo = repo;
        this.cipher = cipher;
        this.misa = misa;
        this.sales = sales;
    }

    /** Không bao giờ trả mật khẩu; chỉ báo đã có hay chưa. */
    public Map<String, Object> settings() {
        var rows = repo.findSettingsRows();
        if (rows.isEmpty()) {
            return Map.of("configured", false, "environment", "TEST", "invoiceName", "Hóa đơn bán hàng");
        }
        var s = rows.get(0);
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
    public Map<String, Object> saveSettings(SettingsRequest r) {
        String enc = r.password() == null || r.password().isBlank() ? null : cipher.encrypt(r.password());
        repo.upsertSettings(r.environment() == null ? "TEST" : r.environment(), r.appId().trim(), r.taxCode().trim(),
                r.username().trim(), enc, r.invSeries().trim().toUpperCase(), r.invoiceName().trim(), r.sendEmail());
        return settings();
    }

    /** Thử đăng nhập MISA bằng thiết lập đã lưu. */
    public void testConnection() {
        misa.token(account());
    }

    public MisaClient.Account account() {
        var rows = repo.findSettingsRows();
        Map<String, Object> s = rows.isEmpty() ? Map.of() : rows.get(0);
        if (s.get("app_id") == null || s.get("password_enc") == null || s.get("inv_series") == null) {
            throw BusinessException.badRequest("EINVOICE_NOT_CONFIGURED",
                    "Chưa thiết lập kết nối MISA meInvoice (Thiết lập → Hóa đơn điện tử)");
        }
        return new MisaClient.Account((String) s.get("environment"), (String) s.get("app_id"), (String) s.get("tax_code"),
                (String) s.get("username"), cipher.decrypt((String) s.get("password_enc")));
    }

    public Map<String, Object> publish(UUID invoiceId) {
        var existing = repo.findRecordRows(invoiceId);
        if (!existing.isEmpty() && "PUBLISHED".equals(existing.get(0).get("status"))) {
            return existing.get(0);
        }
        MisaClient.Account account = account(); // trước: báo "chưa thiết lập" rõ ràng khi chưa có dòng cấu hình
        var settings = repo.getSettings();
        SalesInvoice inv = sales.invoice(invoiceId);
        if (inv == null || !"COMPLETED".equals(inv.status())) {
            throw BusinessException.badRequest("INVOICE_NOT_PUBLISHABLE", "Chỉ phát hành được hóa đơn đã hoàn thành");
        }
        UUID refId = existing.isEmpty() ? UUID.randomUUID() : (UUID) existing.get(0).get("ref_id");
        if (existing.isEmpty()) {
            repo.insertFailedRecord(invoiceId, inv.code(), refId);
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
        repo.updateRecordResult(invoiceId, r.ok() ? "PUBLISHED" : "FAILED", r);
        return repo.getRecord(invoiceId);
    }

    /** Trạng thái HĐĐT của nhiều hóa đơn (cột / bộ lọc ở danh sách hóa đơn). */
    public List<RecordStatus> byInvoices(List<UUID> invoiceIds) {
        if (invoiceIds.isEmpty()) {
            return List.of();
        }
        return repo.findRecordsByInvoiceIds(invoiceIds);
    }

    /** ACCEPTED (đã phát hành, có mã CQT) / PUBLISHED (đã phát hành, chưa có mã CQT) / FAILED (phát hành lỗi). */
    public List<InvoiceStatus> statuses() {
        return repo.statuses();
    }

    public boolean published(UUID invoiceId) {
        return repo.isPublished(invoiceId);
    }
}
