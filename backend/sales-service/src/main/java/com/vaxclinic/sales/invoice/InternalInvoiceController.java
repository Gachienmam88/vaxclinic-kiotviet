package com.vaxclinic.sales.invoice;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.sales.customer.Customer;
import com.vaxclinic.sales.customer.CustomerRepository;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Dữ liệu hóa đơn cho integration-service phát hành hóa đơn điện tử (chỉ JWT "internal"; gateway không route /internal).
 * Người mua lấy theo "Thông tin xuất hóa đơn" của khách, thiếu thì dùng thông tin chung.
 */
@RestController
@PreAuthorize("hasAuthority('internal')")
public class InternalInvoiceController {

    public record Buyer(String code, String fullName, String legalName, String taxCode, String address, String email,
                        String phone, String idNumber) {
    }

    public record Line(int lineNo, String productCode, String productName, String unitName, BigDecimal quantity,
                       BigDecimal unitPrice, BigDecimal discount, String taxCode) {
    }

    public record EInvoiceSource(UUID id, String code, String status, Instant soldAt, String paymentMethod,
                                 BigDecimal subtotal, BigDecimal discount, BigDecimal total, Buyer buyer, List<Line> lines) {
    }

    private final InvoiceRepository invoices;
    private final CustomerRepository customers;

    public InternalInvoiceController(InvoiceRepository invoices, CustomerRepository customers) {
        this.invoices = invoices;
        this.customers = customers;
    }

    @GetMapping("/internal/invoices/{id}")
    @Transactional(readOnly = true)
    public EInvoiceSource get(@PathVariable UUID id) {
        Invoice inv = invoices.findById(id)
                .orElseThrow(() -> BusinessException.notFound("INVOICE_NOT_FOUND", "Không tìm thấy hóa đơn"));
        Customer c = inv.getCustomerId() == null ? null : customers.findById(inv.getCustomerId()).orElse(null);
        Buyer buyer = c == null ? new Buyer(null, "Khách lẻ", null, null, null, null, null, null)
                : new Buyer(c.getCode(), c.getBuyerName() != null ? c.getBuyerName() : c.getName(),
                "COMPANY".equals(c.getCustomerType()) ? c.getCompanyName() : null, c.getTaxCode(),
                first(join(c.getInvoiceAddress(), c.getInvoiceWard(), c.getInvoiceProvince()), join(c.getAddress(), c.getWard(), c.getProvince())),
                first(c.getInvoiceEmail(), c.getEmail()), first(c.getInvoicePhone(), c.getPhone()), c.getIdNumber());
        var lines = inv.getLines().stream().map(l -> new Line(l.getLineNo(), l.getProductCode(), l.getProductName(),
                l.getUnitName(), l.getQuantity(), l.getUnitPrice(), l.getDiscount(), l.getTaxCode())).toList();
        return new EInvoiceSource(inv.getId(), inv.getCode(), inv.getStatus(), inv.getSoldAt(), inv.getPaymentMethod(),
                inv.getSubtotal(), inv.getDiscount(), inv.getTotal(), buyer, lines);
    }

    private static String join(String... parts) {
        String s = String.join(", ", java.util.Arrays.stream(parts).filter(p -> p != null && !p.isBlank()).toList());
        return s.isEmpty() ? null : s;
    }

    private static String first(String a, String b) {
        return a != null && !a.isBlank() ? a : b;
    }
}
