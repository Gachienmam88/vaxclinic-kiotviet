package com.vaxclinic.sales.invoice;

import com.vaxclinic.common.audit.AuditLogger;
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
    private final AuditLogger audit;

    public InvoiceController(InvoiceService service, InvoiceWriter writer, InvoiceQuery query, AuditLogger audit) {
        this.service = service;
        this.writer = writer;
        this.query = query;
        this.audit = audit;
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
                                    @RequestParam(required = false) List<UUID> ids,
                                    @RequestParam(required = false) List<String> states,
                                    @RequestParam(required = false) List<String> deliveries,
                                    @RequestParam(required = false) List<String> returnStates,
                                    @RequestParam(required = false) List<String> einvoiceStatuses,
                                    @RequestParam(required = false) List<String> einvoiceNatures,
                                    @RequestParam(required = false) String customerQ,
                                    @RequestParam(required = false) String productQ,
                                    @RequestParam(required = false) String noteQ,
                                    @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "15") int size) {
        return query.search(new InvoiceQuery.Filter(q, statuses, from, to, createdBy, sellerId, paymentMethods, customerId,
                branchId, Math.max(page, 0), Math.min(Math.max(size, 1), 100), ids, states, deliveries, returnStates,
                einvoiceStatuses, einvoiceNatures, customerQ, productQ, noteQ));
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

    /** Sửa hóa đơn từ màn bán hàng. revision = số phiên bản lúc mở hóa đơn (chống sửa đè). */
    @org.springframework.web.bind.annotation.PutMapping("/{id}")
    @PreAuthorize("hasAuthority('sales.perform')")
    public InvoiceResponse update(@PathVariable UUID id, @RequestParam int revision, @Valid @RequestBody InvoiceRequest req,
                                  @AuthenticationPrincipal Jwt jwt) {
        InvoiceResponse r = query.detail(service.update(id, revision, req, Actor.of(jwt)));
        Actor.of(jwt).audit(audit, r.branchId(), "Hóa đơn", "Sửa", r.code(), "Cập nhật hóa đơn " + r.code() + ", khách "
                + r.customerName() + ", tổng " + Actor.money(r.total()) + ", đã trả " + Actor.money(r.paid()));
        return r;
    }

    /** Sửa tỷ lệ thuế từng dòng (trước khi phát hành hóa đơn điện tử). */
    @PatchMapping("/{id}/tax-codes")
    @PreAuthorize("hasAuthority('sales.perform')")
    public InvoiceResponse updateTaxCodes(@PathVariable UUID id, @Valid @RequestBody List<InvoiceDtos.TaxCodeChange> changes,
                                          @AuthenticationPrincipal Jwt jwt) {
        writer.updateTaxCodes(id, changes);
        InvoiceResponse r = query.detail(id);
        Actor.of(jwt).audit(audit, r.branchId(), "Hóa đơn", "Sửa thuế", r.code(),
                "Sửa tỷ lệ thuế " + changes.size() + " dòng hàng của hóa đơn " + r.code());
        return r;
    }

    /** "Xem giá bán gần nhất" của 1 hàng (ưu tiên cho đúng khách nếu có). */
    @GetMapping("/recent-prices")
    public List<InvoiceDtos.RecentPrice> recentPrices(@RequestParam UUID productId, @RequestParam(required = false) UUID customerId) {
        return query.recentPrices(productId, customerId);
    }

    @PatchMapping("/{id}/info")
    @PreAuthorize("hasAuthority('sales.perform')")
    public InvoiceResponse updateInfo(@PathVariable UUID id, @Valid @RequestBody InfoRequest req, @AuthenticationPrincipal Jwt jwt) {
        service.updateInfo(id, req);
        InvoiceResponse r = query.detail(id);
        Actor.of(jwt).audit(audit, r.branchId(), "Hóa đơn", "Sửa", r.code(), "Cập nhật thông tin hóa đơn " + r.code()
                + ": người bán " + r.sellerName() + ", thời gian " + r.soldAt() + ", kênh bán " + r.salesChannelName() + (r.note() == null ? "" : ", ghi chú " + r.note()));
        return r;
    }

    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasAuthority('sales.cancel')")
    public InvoiceResponse cancel(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        service.cancel(id, Actor.of(jwt));
        InvoiceResponse r = query.detail(id);
        Actor.of(jwt).audit(audit, r.branchId(), "Hóa đơn", "Hủy", r.code(), "Hủy hóa đơn " + r.code() + ", khách "
                + r.customerName() + ", tổng " + Actor.money(r.total()));
        return r;
    }
}
