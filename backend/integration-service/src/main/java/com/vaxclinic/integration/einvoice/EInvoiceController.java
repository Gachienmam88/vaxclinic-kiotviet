package com.vaxclinic.integration.einvoice;

import com.vaxclinic.integration.common.SecretCipher;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Thiết lập MISA meInvoice + phát hành / tra cứu trạng thái hóa đơn điện tử của hóa đơn bán. */
@RestController
public class EInvoiceController {

    public record SettingsRequest(@Pattern(regexp = "TEST|PROD") String environment, @NotBlank(message = "Nhập AppID MISA cấp") String appId,
                                  @NotBlank(message = "Nhập mã số thuế") String taxCode, @NotBlank String username, String password,
                                  @NotBlank(message = "Nhập ký hiệu hóa đơn") String invSeries, @NotBlank String invoiceName,
                                  boolean sendEmail) {
    }

    private final JdbcTemplate jdbc;
    private final SecretCipher cipher;
    private final EInvoiceService service;
    private final MisaClient misa;

    public EInvoiceController(JdbcTemplate jdbc, SecretCipher cipher, EInvoiceService service, MisaClient misa) {
        this.jdbc = jdbc;
        this.cipher = cipher;
        this.service = service;
        this.misa = misa;
    }

    /** Không bao giờ trả mật khẩu; chỉ báo đã có hay chưa. */
    @GetMapping("/api/einvoice/settings")
    @PreAuthorize("hasAuthority('user.manage')")
    public Map<String, Object> settings() {
        var rows = jdbc.queryForList("select * from einvoice_settings where id = 1");
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
    @PutMapping("/api/einvoice/settings")
    @PreAuthorize("hasAuthority('user.manage')")
    public Map<String, Object> save(@Valid @RequestBody SettingsRequest r) {
        String enc = r.password() == null || r.password().isBlank() ? null : cipher.encrypt(r.password());
        jdbc.update("""
                insert into einvoice_settings(id, environment, app_id, tax_code, username, password_enc, inv_series, invoice_name, send_email, updated_at)
                values (1,?,?,?,?,?,?,?,?, now())
                on conflict (id) do update set environment = excluded.environment, app_id = excluded.app_id, tax_code = excluded.tax_code,
                  username = excluded.username, password_enc = coalesce(excluded.password_enc, einvoice_settings.password_enc),
                  inv_series = excluded.inv_series, invoice_name = excluded.invoice_name, send_email = excluded.send_email, updated_at = now()""",
                r.environment() == null ? "TEST" : r.environment(), r.appId().trim(), r.taxCode().trim(), r.username().trim(), enc,
                r.invSeries().trim().toUpperCase(), r.invoiceName().trim(), r.sendEmail());
        return settings();
    }

    /** Thử đăng nhập MISA bằng thiết lập đã lưu. */
    @PostMapping("/api/einvoice/settings/test")
    @PreAuthorize("hasAuthority('user.manage')")
    public Map<String, Object> test() {
        misa.token(service.account());
        return Map.of("ok", true);
    }

    @PostMapping("/api/einvoices/{invoiceId}/publish")
    @PreAuthorize("hasAuthority('sales.perform')")
    public Map<String, Object> publish(@PathVariable UUID invoiceId) {
        return service.publish(invoiceId);
    }

    /** Trạng thái HĐĐT của nhiều hóa đơn (cột / bộ lọc ở danh sách hóa đơn). */
    @GetMapping("/api/einvoices")
    @PreAuthorize("hasAuthority('sales.perform') or hasAuthority('report.view')")
    public List<Map<String, Object>> byInvoices(@RequestParam List<UUID> invoiceIds) {
        if (invoiceIds.isEmpty()) {
            return List.of();
        }
        String in = String.join(",", invoiceIds.stream().map(id -> "?").toList());
        return jdbc.queryForList("select invoice_id, invoice_code, status, inv_series, inv_no, inv_code, inv_date, transaction_id, error, updated_at"
                + " from einvoice_records where invoice_id in (" + in + ")", invoiceIds.toArray());
    }
}
