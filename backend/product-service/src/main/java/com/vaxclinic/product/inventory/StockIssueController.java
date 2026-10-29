package com.vaxclinic.product.inventory;

import com.vaxclinic.common.security.BranchScope;
import com.vaxclinic.common.web.PageResponse;
import com.vaxclinic.product.inventory.InventoryDocDtos.IssueListItem;
import com.vaxclinic.product.inventory.InventoryDocDtos.IssueRequest;
import com.vaxclinic.product.inventory.InventoryDocDtos.IssueResponse;
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
 * /api/stock-issues?type=DAMAGE|INTERNAL — xuất hủy / xuất dùng nội bộ.
 * ?complete=true khi lưu = "Hoàn thành" (trừ kho ngay); false = "Lưu tạm". Nghiệp vụ ở {@link StockIssueManageService}.
 */
@RestController
@RequestMapping("/api/stock-issues")
@PreAuthorize("hasAuthority('inventory.view')")
public class StockIssueController {

    private final StockIssueManageService service;

    public StockIssueController(StockIssueManageService service) {
        this.service = service;
    }

    @GetMapping
    public PageResponse<IssueListItem> list(@RequestParam String type,
                                            @RequestParam(required = false) String q,
                                            @RequestParam(required = false) List<String> statuses,
                                            @RequestParam(required = false) Instant from,
                                            @RequestParam(required = false) Instant to,
                                            @RequestParam(required = false) UUID createdBy,
                                            @RequestParam(required = false) UUID branchId,
                                            @RequestParam(defaultValue = "0") int page,
                                            @RequestParam(defaultValue = "15") int size, @AuthenticationPrincipal Jwt jwt) {
        return service.list(type, new InventoryDocListRepository.Filter(q, statuses, from, to, createdBy, branchId,
                Math.max(page, 0), Math.min(Math.max(size, 1), 100), BranchScope.check(jwt, branchId)));
    }

    @GetMapping("/{id}")
    public IssueResponse get(@PathVariable UUID id, @RequestParam String type) {
        return service.get(type, id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('inventory.manage')")
    public IssueResponse create(@RequestParam String type, @Valid @RequestBody IssueRequest req,
                                @RequestParam(defaultValue = "false") boolean complete, @AuthenticationPrincipal Jwt jwt) {
        return service.create(type, req, complete, Actor.of(jwt));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('inventory.manage')")
    public IssueResponse update(@PathVariable UUID id, @RequestParam String type, @Valid @RequestBody IssueRequest req,
                                @RequestParam(defaultValue = "false") boolean complete, @AuthenticationPrincipal Jwt jwt) {
        return service.update(type, id, req, complete, Actor.of(jwt));
    }

    @PostMapping("/{id}/complete")
    @PreAuthorize("hasAuthority('inventory.manage')")
    public IssueResponse complete(@PathVariable UUID id, @RequestParam String type, @AuthenticationPrincipal Jwt jwt) {
        return service.complete(type, id, Actor.of(jwt));
    }

    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasAuthority('inventory.manage')")
    public IssueResponse cancel(@PathVariable UUID id, @RequestParam String type, @AuthenticationPrincipal Jwt jwt) {
        return service.cancel(type, id, Actor.of(jwt));
    }
}
