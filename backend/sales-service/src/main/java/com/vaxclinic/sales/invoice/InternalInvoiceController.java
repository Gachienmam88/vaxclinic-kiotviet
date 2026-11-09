package com.vaxclinic.sales.invoice;

import com.vaxclinic.sales.invoice.EInvoiceSourceService.EInvoiceSource;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * Dữ liệu hóa đơn cho integration-service phát hành hóa đơn điện tử (chỉ JWT "internal"; gateway không route /internal).
 * Người mua lấy theo "Thông tin xuất hóa đơn" của khách, thiếu thì dùng thông tin chung.
 */
@RestController
@PreAuthorize("hasAuthority('internal')")
public class InternalInvoiceController {

    private final EInvoiceSourceService service;

    public InternalInvoiceController(EInvoiceSourceService service) {
        this.service = service;
    }

    @GetMapping("/internal/invoices/{id}")
    public EInvoiceSource get(@PathVariable UUID id) {
        return service.get(id);
    }
}
