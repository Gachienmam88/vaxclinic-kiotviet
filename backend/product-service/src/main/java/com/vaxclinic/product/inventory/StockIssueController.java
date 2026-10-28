package com.vaxclinic.product.inventory;

import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.common.web.PageResponse;
import com.vaxclinic.product.inventory.InventoryDocDtos.IssueListItem;
import com.vaxclinic.product.inventory.InventoryDocDtos.IssueRequest;
import com.vaxclinic.product.inventory.InventoryDocDtos.IssueResponse;
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
 * ?complete=true khi lưu = "Hoàn thành" (trừ kho ngay); false = "Lưu tạm".
 */
@RestController
@RequestMapping("/api/stock-issues")
@PreAuthorize("hasAuthority('inventory.view')")
public class StockIssueController {

    private final StockIssueService service;
    private final InventoryDocListQuery listQuery;
    private final InventoryDocMapper mapper;
    private final AuditLogger audit;

    public StockIssueController(StockIssueService service, InventoryDocListQuery listQuery, InventoryDocMapper mapper,
                                AuditLogger audit) {
        this.service = service;
        this.listQuery = listQuery;
        this.mapper = mapper;
        this.audit = audit;
    }

    private static StockIssue.Type type(String type) {
        try {
            return StockIssue.Type.valueOf(type);
        } catch (IllegalArgumentException e) {
            throw BusinessException.badRequest("ISSUE_TYPE_INVALID", "Loại phiếu xuất không hợp lệ (DAMAGE hoặc INTERNAL)");
        }
    }

    /** Ghi lịch sử thao tác (Thiết lập → Lịch sử thao tác). */
    private IssueResponse log(Jwt jwt, IssueResponse d, String action) {
        String label = type(d.type()).label;
        audit.record(UUID.fromString(jwt.getSubject()), jwt.getClaimAsString("name"), d.branchId(), label, action,
                d.code(), action + " phiếu " + label.toLowerCase() + " " + d.code() + ", tổng giá trị "
                        + String.format("%,.0f", d.totalValue()));
        return d;
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
                                            @RequestParam(defaultValue = "15") int size) {
        return listQuery.issues(type(type), new InventoryDocListQuery.Filter(q, statuses, from, to, createdBy, branchId,
                Math.max(page, 0), Math.min(Math.max(size, 1), 100)));
    }

    @GetMapping("/{id}")
    public IssueResponse get(@PathVariable UUID id, @RequestParam String type) {
        service.find(type(type), id);
        return mapper.issue(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('inventory.manage')")
    public IssueResponse create(@RequestParam String type, @Valid @RequestBody IssueRequest req,
                                @RequestParam(defaultValue = "false") boolean complete, @AuthenticationPrincipal Jwt jwt) {
        UUID id = service.save(type(type), null, req, complete, InventoryDocDtos.actor(jwt));
        return log(jwt, mapper.issue(id), complete ? "Hoàn thành" : "Lưu tạm");
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('inventory.manage')")
    public IssueResponse update(@PathVariable UUID id, @RequestParam String type, @Valid @RequestBody IssueRequest req,
                                @RequestParam(defaultValue = "false") boolean complete, @AuthenticationPrincipal Jwt jwt) {
        service.save(type(type), id, req, complete, InventoryDocDtos.actor(jwt));
        return log(jwt, mapper.issue(id), complete ? "Hoàn thành" : "Lưu tạm");
    }

    @PostMapping("/{id}/complete")
    @PreAuthorize("hasAuthority('inventory.manage')")
    public IssueResponse complete(@PathVariable UUID id, @RequestParam String type, @AuthenticationPrincipal Jwt jwt) {
        service.complete(type(type), id, InventoryDocDtos.actor(jwt));
        return log(jwt, mapper.issue(id), "Hoàn thành");
    }

    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasAuthority('inventory.manage')")
    public IssueResponse cancel(@PathVariable UUID id, @RequestParam String type, @AuthenticationPrincipal Jwt jwt) {
        service.cancel(type(type), id, InventoryDocDtos.actor(jwt));
        return log(jwt, mapper.issue(id), "Hủy");
    }
}
