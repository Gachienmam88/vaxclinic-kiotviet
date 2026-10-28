package com.vaxclinic.sales.invoice;

import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.invoice.InvoiceDtos.InfoRequest;
import com.vaxclinic.sales.invoice.InvoiceDtos.InvoiceListResponse;
import com.vaxclinic.sales.invoice.InvoiceDtos.InvoiceRequest;
import com.vaxclinic.sales.invoice.InvoiceDtos.InvoiceResponse;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/invoices")
@PreAuthorize("hasAuthority('sales.perform') or hasAuthority('report.view')")
public class InvoiceController {

    private final InvoiceService service;
    private final InvoiceWriter writer;
    private final InvoiceQuery query;

    public InvoiceController(InvoiceService service, InvoiceWriter writer, InvoiceQuery query) {
        this.service = service;
        this.writer = writer;
        this.query = query;
    }

    @GetMapping
    public InvoiceListResponse list(@RequestParam(required = false) String q,
                                    @RequestParam(required = false) List<String> statuses,
                                    @RequestParam(required = false) Instant from, @RequestParam(required = false) Instant to,
                                    @RequestParam(required = false) UUID createdBy,
                                    @RequestParam(required = false) UUID sellerId,
                                    @RequestParam(required = false) List<String> paymentMethods,
                                    @RequestParam(required = false) UUID customerId,
                                    @RequestParam(required = false) UUID branchId,
                                    @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "15") int size) {
        return query.search(new InvoiceQuery.Filter(q, statuses, from, to, createdBy, sellerId, paymentMethods, customerId,
                branchId, Math.max(page, 0), Math.min(Math.max(size, 1), 100)));
    }

    @GetMapping("/{id}")
    public InvoiceResponse get(@PathVariable UUID id) {
        return query.detail(id);
    }

    /** Thanh toán ở màn bán hàng. Gửi lại cùng id (offline / retry) trả về hóa đơn đã tạo, không tạo trùng. */
    @PostMapping
    @PreAuthorize("hasAuthority('sales.perform')")
    public InvoiceResponse create(@Valid @RequestBody InvoiceRequest req, @AuthenticationPrincipal Jwt jwt) {
        return query.detail(service.create(req, Actor.of(jwt)));
    }

    @PatchMapping("/{id}/info")
    @PreAuthorize("hasAuthority('sales.perform')")
    public InvoiceResponse updateInfo(@PathVariable UUID id, @Valid @RequestBody InfoRequest req) {
        writer.updateInfo(id, req);
        return query.detail(id);
    }

    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasAuthority('sales.cancel')")
    public InvoiceResponse cancel(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        service.cancel(id, Actor.of(jwt));
        return query.detail(id);
    }
}
