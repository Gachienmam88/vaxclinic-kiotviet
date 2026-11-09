package com.vaxclinic.integration.einvoice;

import com.vaxclinic.integration.einvoice.EInvoiceDtos.InvoiceStatus;
import com.vaxclinic.integration.einvoice.EInvoiceDtos.OkResponse;
import com.vaxclinic.integration.einvoice.EInvoiceDtos.PublishedResponse;
import com.vaxclinic.integration.einvoice.EInvoiceDtos.RecordStatus;
import com.vaxclinic.integration.einvoice.EInvoiceDtos.SettingsRequest;
import jakarta.validation.Valid;
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

/** Thiết lập MISA meInvoice + phát hành / tra cứu trạng thái hóa đơn điện tử của hóa đơn bán. */
@RestController
public class EInvoiceController {

    private final EInvoiceService service;

    public EInvoiceController(EInvoiceService service) {
        this.service = service;
    }

    /** Không bao giờ trả mật khẩu; chỉ báo đã có hay chưa. */
    @GetMapping("/api/einvoice/settings")
    @PreAuthorize("hasAuthority('user.manage')")
    public Map<String, Object> settings() {
        return service.settings();
    }

    /** Lưu thiết lập; để trống mật khẩu = giữ mật khẩu cũ. */
    @PutMapping("/api/einvoice/settings")
    @PreAuthorize("hasAuthority('user.manage')")
    public Map<String, Object> save(@Valid @RequestBody SettingsRequest r) {
        return service.saveSettings(r);
    }

    /** Thử đăng nhập MISA bằng thiết lập đã lưu. */
    @PostMapping("/api/einvoice/settings/test")
    @PreAuthorize("hasAuthority('user.manage')")
    public OkResponse test() {
        service.testConnection();
        return new OkResponse(true);
    }

    @PostMapping("/api/einvoices/{invoiceId}/publish")
    @PreAuthorize("hasAuthority('sales.perform')")
    public Map<String, Object> publish(@PathVariable UUID invoiceId) {
        return service.publish(invoiceId);
    }

    /** Trạng thái HĐĐT của nhiều hóa đơn (cột / bộ lọc ở danh sách hóa đơn). */
    @GetMapping("/api/einvoices")
    @PreAuthorize("hasAuthority('sales.perform') or hasAuthority('report.view')")
    public List<RecordStatus> byInvoices(@RequestParam List<UUID> invoiceIds) {
        return service.byInvoices(invoiceIds);
    }

    /**
     * sales-service lọc danh sách hóa đơn theo "Trạng thái HĐĐT": mọi hóa đơn đã có bản ghi phát hành, phân loại
     * ACCEPTED (đã phát hành, có mã CQT) / PUBLISHED (đã phát hành, chưa có mã CQT) / FAILED (phát hành lỗi).
     */
    @GetMapping("/internal/einvoices/statuses")
    @PreAuthorize("hasAuthority('internal')")
    public List<InvoiceStatus> statuses() {
        return service.statuses();
    }

    /** sales-service hỏi trước khi sửa / hủy hóa đơn (thiết lập "Chặn chỉnh sửa/hủy hóa đơn đã phát hành HĐĐT"). */
    @GetMapping("/internal/einvoices/{invoiceId}/published")
    @PreAuthorize("hasAuthority('internal')")
    public PublishedResponse published(@PathVariable UUID invoiceId) {
        return new PublishedResponse(service.published(invoiceId));
    }
}
