package com.vaxclinic.product.inventory;

import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.common.web.PageResponse;
import com.vaxclinic.product.inventory.InventoryDocDtos.IssueListItem;
import com.vaxclinic.product.inventory.InventoryDocDtos.IssueRequest;
import com.vaxclinic.product.inventory.InventoryDocDtos.IssueResponse;
import com.vaxclinic.product.purchase.PurchaseDtos.Actor;
import org.springframework.stereotype.Service;

import java.util.UUID;

/**
 * Phiếu xuất hủy / xuất dùng nội bộ cho màn hình: kiểm tra loại phiếu, gọi {@link StockIssueService} (transaction riêng)
 * rồi đọc lại phiếu và ghi lịch sử thao tác sau khi đã commit.
 */
@Service
public class StockIssueManageService {

    private final StockIssueService service;
    private final InventoryDocListRepository listQuery;
    private final InventoryDocMapper mapper;
    private final AuditLogger audit;

    public StockIssueManageService(StockIssueService service, InventoryDocListRepository listQuery, InventoryDocMapper mapper,
                                   AuditLogger audit) {
        this.service = service;
        this.listQuery = listQuery;
        this.mapper = mapper;
        this.audit = audit;
    }

    public PageResponse<IssueListItem> list(String type, InventoryDocListRepository.Filter filter) {
        return listQuery.issues(type(type), filter);
    }

    public IssueResponse get(String type, UUID id) {
        service.find(type(type), id);
        return mapper.issue(id);
    }

    public IssueResponse create(String type, IssueRequest req, boolean complete, Actor actor) {
        UUID id = service.save(type(type), null, req, complete, actor);
        return log(actor, mapper.issue(id), complete ? "Hoàn thành" : "Lưu tạm");
    }

    public IssueResponse update(String type, UUID id, IssueRequest req, boolean complete, Actor actor) {
        service.save(type(type), id, req, complete, actor);
        return log(actor, mapper.issue(id), complete ? "Hoàn thành" : "Lưu tạm");
    }

    public IssueResponse complete(String type, UUID id, Actor actor) {
        service.complete(type(type), id, actor);
        return log(actor, mapper.issue(id), "Hoàn thành");
    }

    public IssueResponse cancel(String type, UUID id, Actor actor) {
        service.cancel(type(type), id, actor);
        return log(actor, mapper.issue(id), "Hủy");
    }

    private static StockIssue.Type type(String type) {
        try {
            return StockIssue.Type.valueOf(type);
        } catch (IllegalArgumentException e) {
            throw BusinessException.badRequest("ISSUE_TYPE_INVALID", "Loại phiếu xuất không hợp lệ (DAMAGE hoặc INTERNAL)");
        }
    }

    /** Ghi lịch sử thao tác (Thiết lập → Lịch sử thao tác). */
    private IssueResponse log(Actor actor, IssueResponse d, String action) {
        String label = type(d.type()).label;
        audit.record(actor.id(), actor.name(), d.branchId(), label, action,
                d.code(), action + " phiếu " + label.toLowerCase() + " " + d.code() + ", tổng giá trị "
                        + String.format("%,.0f", d.totalValue()));
        return d;
    }
}
