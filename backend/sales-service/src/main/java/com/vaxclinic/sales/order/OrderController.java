package com.vaxclinic.sales.order;

import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.invoice.InvoiceDtos.InvoiceRequest;
import com.vaxclinic.sales.invoice.InvoiceDtos.InvoiceResponse;
import com.vaxclinic.sales.invoice.InvoiceQuery;
import com.vaxclinic.sales.invoice.InvoiceService;
import com.vaxclinic.sales.order.OrderDtos.OrderListResponse;
import com.vaxclinic.sales.order.OrderDtos.OrderRequest;
import com.vaxclinic.sales.order.OrderDtos.OrderResponse;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Đặt hàng: danh sách / chi tiết, tạo & sửa từ màn bán hàng, xác nhận, hủy (hoàn cọc), tạo hóa đơn. */
@RestController
@RequestMapping("/api/orders")
@PreAuthorize("hasAuthority('sales.perform') or hasAuthority('report.view')")
public class OrderController {

    private final OrderService service;
    private final OrderQuery query;
    private final InvoiceService invoices;
    private final InvoiceQuery invoiceQuery;
    private final AuditLogger audit;

    public OrderController(OrderService service, OrderQuery query, InvoiceService invoices, InvoiceQuery invoiceQuery,
                           AuditLogger audit) {
        this.service = service;
        this.query = query;
        this.invoices = invoices;
        this.invoiceQuery = invoiceQuery;
        this.audit = audit;
    }

    @GetMapping
    public OrderListResponse list(@RequestParam(required = false) String q,
                                  @RequestParam(required = false) List<String> statuses,
                                  @RequestParam(required = false) Instant from, @RequestParam(required = false) Instant to,
                                  @RequestParam(required = false) UUID createdBy,
                                  @RequestParam(required = false) UUID customerId,
                                  @RequestParam(required = false) UUID branchId,
                                  @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "15") int size) {
        return query.search(new OrderQuery.Filter(q, statuses, from, to, createdBy, customerId, branchId,
                Math.max(page, 0), Math.min(Math.max(size, 1), 100)));
    }

    @GetMapping("/{id}")
    public OrderResponse get(@PathVariable UUID id) {
        return query.detail(id);
    }

    @PostMapping
    @PreAuthorize("hasAuthority('sales.perform')")
    public OrderResponse create(@Valid @RequestBody OrderRequest req, @AuthenticationPrincipal Jwt jwt) {
        boolean isNew = !service.exists(req.id());
        OrderResponse r = query.detail(service.create(req, Actor.of(jwt)).getId());
        if (isNew) {
            log(jwt, r, "Tạo", "Tạo đơn đặt hàng " + r.code());
        }
        return r;
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('sales.perform')")
    public OrderResponse update(@PathVariable UUID id, @Valid @RequestBody OrderRequest req, @AuthenticationPrincipal Jwt jwt) {
        OrderResponse r = query.detail(service.update(id, req, Actor.of(jwt)).getId());
        log(jwt, r, "Sửa", "Cập nhật đơn đặt hàng " + r.code());
        return r;
    }

    @PostMapping("/{id}/confirm")
    @PreAuthorize("hasAuthority('sales.perform')")
    public OrderResponse confirm(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        OrderResponse r = query.detail(service.confirm(id, Actor.of(jwt)).getId());
        log(jwt, r, "Xác nhận", "Xác nhận đơn đặt hàng " + r.code());
        return r;
    }

    /**
     * refundMethod: tiền cọc hoàn bằng CASH (mặc định) / TRANSFER (bankAccountId) / CARD / EWALLET → phiếu chi PC{mã đơn};
     * CREDIT = giữ cọc làm tiền khách trả trước (không lập phiếu chi, công nợ khách giữ nguyên số âm).
     */
    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasAuthority('sales.cancel')")
    public OrderResponse cancel(@PathVariable UUID id, @RequestParam(required = false) String refundMethod,
                                @RequestParam(required = false) UUID bankAccountId, @AuthenticationPrincipal Jwt jwt) {
        if (refundMethod != null && !refundMethod.matches("CASH|TRANSFER|CARD|EWALLET|CREDIT")) {
            throw BusinessException.badRequest("REFUND_METHOD_INVALID", "Hình thức hoàn cọc không hợp lệ");
        }
        var before = query.detail(id).deposit();
        OrderResponse r = query.detail(service.cancel(id, refundMethod, bankAccountId, Actor.of(jwt)).getId());
        log(jwt, r, "Hủy", "Hủy đơn đặt hàng " + r.code() + (before.signum() <= 0 ? "" : "CREDIT".equals(refundMethod)
                ? ", giữ tiền cọc " + Actor.money(before) + " làm công nợ (tiền khách trả trước)"
                : ", hoàn tiền cọc " + Actor.money(before) + " (phiếu PC" + r.code() + ")"));
        return r;
    }

    /** "Tạo hóa đơn": hóa đơn bán thường (trừ kho) gắn với đơn; tiền cọc tính vào khách đã trả. */
    @PostMapping("/{id}/invoice")
    @PreAuthorize("hasAuthority('sales.perform')")
    public InvoiceResponse toInvoice(@PathVariable UUID id, @Valid @RequestBody InvoiceRequest req,
                                     @AuthenticationPrincipal Jwt jwt) {
        return invoiceQuery.detail(invoices.create(req.withOrderId(id), Actor.of(jwt)));
    }

    private void log(Jwt jwt, OrderResponse r, String action, String detail) {
        Actor.of(jwt).audit(audit, r.branchId(), "Đặt hàng", action, r.code(), detail + ", khách " + r.customerName()
                + ", tổng " + Actor.money(r.total()) + ", khách đã trả " + Actor.money(r.deposit()));
    }
}
