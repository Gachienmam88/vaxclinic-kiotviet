package com.vaxclinic.product.inventory;

import com.vaxclinic.common.web.PageResponse;
import com.vaxclinic.product.inventory.InventoryDocDtos.TakeListItem;
import com.vaxclinic.product.inventory.InventoryDocDtos.TakeRequest;
import com.vaxclinic.product.inventory.InventoryDocDtos.TakeResponse;
import com.vaxclinic.product.purchase.PurchaseDtos.Actor;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
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
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * /api/stock-takes — kiểm kho. ?complete=true khi lưu = "Hoàn thành" (cân bằng kho ngay); false = "Lưu tạm".
 * Nghiệp vụ ở {@link StockTakeManageService}.
 */
@RestController
@RequestMapping("/api/stock-takes")
@PreAuthorize("hasAuthority('inventory.view')")
public class StockTakeController {

    private final StockTakeManageService service;

    public StockTakeController(StockTakeManageService service) {
        this.service = service;
    }

    @GetMapping
    public PageResponse<TakeListItem> list(@RequestParam(required = false) String q,
                                           @RequestParam(required = false) List<String> statuses,
                                           @RequestParam(required = false) Instant from,
                                           @RequestParam(required = false) Instant to,
                                           @RequestParam(required = false) UUID createdBy,
                                           @RequestParam(required = false) UUID branchId,
                                           @RequestParam(defaultValue = "0") int page,
                                           @RequestParam(defaultValue = "15") int size) {
        return service.list(new InventoryDocListQuery.Filter(q, statuses, from, to, createdBy, branchId,
                Math.max(page, 0), Math.min(Math.max(size, 1), 100)));
    }

    @GetMapping("/{id}")
    public TakeResponse get(@PathVariable UUID id) {
        return service.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('inventory.manage')")
    public TakeResponse create(@Valid @RequestBody TakeRequest req, @RequestParam(defaultValue = "false") boolean complete,
                               @AuthenticationPrincipal Jwt jwt) {
        return service.create(req, complete, Actor.of(jwt));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('inventory.manage')")
    public TakeResponse update(@PathVariable UUID id, @Valid @RequestBody TakeRequest req,
                               @RequestParam(defaultValue = "false") boolean complete, @AuthenticationPrincipal Jwt jwt) {
        return service.update(id, req, complete, Actor.of(jwt));
    }

    @PostMapping("/{id}/complete")
    @PreAuthorize("hasAuthority('inventory.manage')")
    public TakeResponse complete(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        return service.complete(id, Actor.of(jwt));
    }

    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasAuthority('inventory.manage')")
    public TakeResponse cancel(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        return service.cancel(id, Actor.of(jwt));
    }
}
