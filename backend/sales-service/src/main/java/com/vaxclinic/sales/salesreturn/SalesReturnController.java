package com.vaxclinic.sales.salesreturn;

import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.salesreturn.SalesReturnDtos.ReturnRequest;
import com.vaxclinic.sales.salesreturn.SalesReturnDtos.ReturnResponse;
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
import java.util.Map;
import java.util.UUID;

/** /api/sales-returns: khách trả hàng (Đơn hàng → Trả hàng). Nghiệp vụ ở {@link SalesReturnManageService}. */
@RestController
@PreAuthorize("hasAuthority('sales.perform')")
public class SalesReturnController {

    private final SalesReturnManageService service;

    public SalesReturnController(SalesReturnManageService service) {
        this.service = service;
    }

    @GetMapping("/api/sales-returns")
    public Map<String, Object> list(@RequestParam(required = false) String q, @RequestParam(required = false) List<String> statuses,
                                    @RequestParam(required = false) Instant from, @RequestParam(required = false) Instant to,
                                    @RequestParam(required = false) UUID invoiceId,
                                    @RequestParam(required = false) List<String> types,
                                    @RequestParam(required = false) List<String> deliveryStatuses,
                                    @RequestParam(required = false) UUID partnerId,
                                    @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "15") int size) {
        return service.list(new SalesReturnQueryRepository.Filter(q, statuses, from, to, invoiceId, types, deliveryStatuses, partnerId),
                page, size);
    }

    /** "Xuất file" (tổng quan / chi tiết): mọi phiếu khớp bộ lọc + dòng hàng. */
    @GetMapping("/api/sales-returns/export")
    public SalesReturnDtos.ExportResponse export(@RequestParam(required = false) String q, @RequestParam(required = false) List<String> statuses,
                                                 @RequestParam(required = false) Instant from, @RequestParam(required = false) Instant to,
                                                 @RequestParam(required = false) List<String> types,
                                                 @RequestParam(required = false) List<String> deliveryStatuses,
                                                 @RequestParam(required = false) UUID partnerId) {
        return service.export(new SalesReturnQueryRepository.Filter(q, statuses, from, to, null, types, deliveryStatuses, partnerId));
    }

    @GetMapping("/api/sales-returns/{id}")
    public ReturnResponse get(@PathVariable UUID id) {
        return service.get(id);
    }

    @PostMapping("/api/sales-returns")
    public ReturnResponse create(@Valid @RequestBody ReturnRequest req, @AuthenticationPrincipal Jwt jwt) {
        return service.create(req, Actor.of(jwt), jwt.getTokenValue());
    }

    @PostMapping("/api/sales-returns/{id}/cancel")
    @PreAuthorize("hasAuthority('sales.cancel')")
    public ReturnResponse cancel(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        return service.cancel(id, Actor.of(jwt));
    }
}
