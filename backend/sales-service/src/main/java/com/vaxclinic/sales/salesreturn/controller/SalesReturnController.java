package com.vaxclinic.sales.salesreturn.controller;

import com.vaxclinic.sales.salesreturn.dto.SalesReturnDtos;
import com.vaxclinic.sales.salesreturn.service.SalesReturnQuery;
import com.vaxclinic.sales.salesreturn.service.SalesReturnService;
import com.vaxclinic.sales.salesreturn.service.SalesReturnWriter;
import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.salesreturn.dto.SalesReturnDtos.ListPage;
import com.vaxclinic.sales.salesreturn.dto.SalesReturnDtos.ReturnRequest;
import com.vaxclinic.sales.salesreturn.dto.SalesReturnDtos.ReturnResponse;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** /api/sales-returns: khách trả hàng (Đơn hàng → Trả hàng). */
@RestController
@PreAuthorize("hasAuthority('sales.perform')")
public class SalesReturnController {

    private final SalesReturnService service;
    private final SalesReturnWriter writer;
    private final SalesReturnQuery query;
    private final AuditLogger audit;

    public SalesReturnController(SalesReturnService service, SalesReturnWriter writer, SalesReturnQuery query,
                                 AuditLogger audit) {
        this.service = service;
        this.writer = writer;
        this.query = query;
        this.audit = audit;
    }

    @GetMapping("/api/sales-returns")
    public ListPage list(@RequestParam(required = false) String q, @RequestParam(required = false) List<String> statuses,
                                    @RequestParam(required = false) Instant from, @RequestParam(required = false) Instant to,
                                    @RequestParam(required = false) UUID invoiceId,
                                    @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "15") int size) {
        return query.list(q, statuses, from, to, invoiceId, page, size);
    }

    @GetMapping("/api/sales-returns/{id}")
    public ReturnResponse get(@PathVariable UUID id) {
        return query.get(id);
    }

    @PostMapping("/api/sales-returns")
    public ReturnResponse create(@Valid @RequestBody ReturnRequest req, @AuthenticationPrincipal Jwt jwt) {
        boolean existed = writer.exists(req.id());
        ReturnResponse r = query.get(service.create(req, Actor.of(jwt), jwt.getTokenValue()));
        if (!existed) {
            Actor.of(jwt).audit(audit, r.branchId(), "Trả hàng", "Tạo", r.code(), "Tạo phiếu trả hàng " + r.code()
                    + (r.invoiceCode() == null ? " (trả nhanh)" : " theo hóa đơn " + r.invoiceCode())
                    + ", khách " + r.customerName() + ", cần trả khách " + Actor.money(r.total()));
        }
        return r;
    }

    @PostMapping("/api/sales-returns/{id}/cancel")
    @PreAuthorize("hasAuthority('sales.cancel')")
    public ReturnResponse cancel(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        service.cancel(id, Actor.of(jwt));
        ReturnResponse r = query.get(id);
        Actor.of(jwt).audit(audit, r.branchId(), "Trả hàng", "Hủy", r.code(), "Hủy phiếu trả hàng " + r.code()
                + (r.invoiceCode() == null ? " (trả nhanh)" : " của hóa đơn " + r.invoiceCode()));
        return r;
    }
}
