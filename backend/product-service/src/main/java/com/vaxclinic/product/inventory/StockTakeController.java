package com.vaxclinic.product.inventory;

import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.common.web.PageResponse;
import com.vaxclinic.product.inventory.InventoryDocDtos.TakeListItem;
import com.vaxclinic.product.inventory.InventoryDocDtos.TakeRequest;
import com.vaxclinic.product.inventory.InventoryDocDtos.TakeResponse;
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

/** /api/stock-takes — kiểm kho. ?complete=true khi lưu = "Hoàn thành" (cân bằng kho ngay); false = "Lưu tạm". */
@RestController
@RequestMapping("/api/stock-takes")
@PreAuthorize("hasAuthority('inventory.view')")
public class StockTakeController {

    private static final String FEATURE = "Kiểm kho";

    private final StockTakeService service;
    private final InventoryDocListQuery listQuery;
    private final InventoryDocMapper mapper;
    private final AuditLogger audit;

    public StockTakeController(StockTakeService service, InventoryDocListQuery listQuery, InventoryDocMapper mapper,
                               AuditLogger audit) {
        this.service = service;
        this.listQuery = listQuery;
        this.mapper = mapper;
        this.audit = audit;
    }

    /** Ghi lịch sử thao tác (Thiết lập → Lịch sử thao tác). */
    private TakeResponse log(Jwt jwt, TakeResponse t, String action) {
        audit.record(UUID.fromString(jwt.getSubject()), jwt.getClaimAsString("name"), t.branchId(), FEATURE, action,
                t.code(), action + " phiếu kiểm kho " + t.code() + ", lệch tăng " + t.increaseQuantity().stripTrailingZeros().toPlainString()
                        + ", lệch giảm " + t.decreaseQuantity().stripTrailingZeros().toPlainString()
                        + ", tổng chênh lệch " + String.format("%,.0f", t.diffValue()));
        return t;
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
        return listQuery.takes(new InventoryDocListQuery.Filter(q, statuses, from, to, createdBy, branchId,
                Math.max(page, 0), Math.min(Math.max(size, 1), 100)));
    }

    @GetMapping("/{id}")
    public TakeResponse get(@PathVariable UUID id) {
        service.find(id);
        return mapper.take(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('inventory.manage')")
    public TakeResponse create(@Valid @RequestBody TakeRequest req, @RequestParam(defaultValue = "false") boolean complete,
                               @AuthenticationPrincipal Jwt jwt) {
        UUID id = service.save(null, req, complete, InventoryDocDtos.actor(jwt));
        return log(jwt, mapper.take(id), complete ? "Cân bằng kho" : "Lưu tạm");
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('inventory.manage')")
    public TakeResponse update(@PathVariable UUID id, @Valid @RequestBody TakeRequest req,
                               @RequestParam(defaultValue = "false") boolean complete, @AuthenticationPrincipal Jwt jwt) {
        service.save(id, req, complete, InventoryDocDtos.actor(jwt));
        return log(jwt, mapper.take(id), complete ? "Cân bằng kho" : "Lưu tạm");
    }

    @PostMapping("/{id}/complete")
    @PreAuthorize("hasAuthority('inventory.manage')")
    public TakeResponse complete(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        service.complete(id, InventoryDocDtos.actor(jwt));
        return log(jwt, mapper.take(id), "Cân bằng kho");
    }

    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasAuthority('inventory.manage')")
    public TakeResponse cancel(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        service.cancel(id);
        return log(jwt, mapper.take(id), "Hủy");
    }
}
