package com.vaxclinic.integration.einvoice;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Thiết lập MISA meInvoice + phát hành / tra cứu trạng thái hóa đơn điện tử của hóa đơn bán.
 * Nghiệp vụ ở {@link EInvoiceSettingsService} (thiết lập, tra cứu) và {@link EInvoiceService} (phát hành).
 */
@RestController
public class EInvoiceController {

    public record SettingsRequest(@Pattern(regexp = "TEST|PROD") String environment, @NotBlank(message = "Nhập AppID MISA cấp") String appId,
                                  @NotBlank(message = "Nhập mã số thuế") String taxCode, @NotBlank String username, String password,
                                  @NotBlank(message = "Nhập ký hiệu hóa đơn") String invSeries, @NotBlank String invoiceName,
                                  boolean sendEmail) {
    }

    private final EInvoiceSettingsService settings;
    private final EInvoiceService service;

    public EInvoiceController(EInvoiceSettingsService settings, EInvoiceService service) {
        this.settings = settings;
        this.service = service;
    }

    /** Không bao giờ trả mật khẩu; chỉ báo đã có hay chưa. */
    @GetMapping("/api/einvoice/settings")
    @PreAuthorize("hasAuthority('user.manage')")
    public Map<String, Object> settings() {
        return settings.settings();
    }

    /** Lưu thiết lập; để trống mật khẩu = giữ mật khẩu cũ. */
    @PutMapping("/api/einvoice/settings")
    @PreAuthorize("hasAuthority('user.manage')")
    public Map<String, Object> save(@Valid @RequestBody SettingsRequest r) {
        return settings.save(r);
    }

    /** Thử đăng nhập MISA bằng thiết lập đã lưu. */
    @PostMapping("/api/einvoice/settings/test")
    @PreAuthorize("hasAuthority('user.manage')")
    public Map<String, Object> test() {
        return settings.test();
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
        return settings.byInvoices(invoiceIds);
    }

    /**
     * sales-service lọc danh sách hóa đơn theo "Trạng thái HĐĐT": mọi hóa đơn đã có bản ghi phát hành, phân loại
     * ACCEPTED (đã phát hành, có mã CQT) / PUBLISHED (đã phát hành, chưa có mã CQT) / FAILED (phát hành lỗi).
     */
    @GetMapping("/internal/einvoices/statuses")
    @PreAuthorize("hasAuthority('internal')")
    public List<Map<String, Object>> statuses() {
        return settings.statuses();
    }

    /** sales-service hỏi trước khi sửa / hủy hóa đơn (thiết lập "Chặn chỉnh sửa/hủy hóa đơn đã phát hành HĐĐT"). */
    @GetMapping("/internal/einvoices/{invoiceId}/published")
    @PreAuthorize("hasAuthority('internal')")
    public Map<String, Object> published(@PathVariable UUID invoiceId) {
        return settings.published(invoiceId);
    }
}
