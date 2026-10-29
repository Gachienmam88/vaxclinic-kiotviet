package com.vaxclinic.product.inventory;

import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.common.web.PageResponse;
import com.vaxclinic.product.inventory.InventoryDocDtos.TakeListItem;
import com.vaxclinic.product.inventory.InventoryDocDtos.TakeRequest;
import com.vaxclinic.product.inventory.InventoryDocDtos.TakeResponse;
import com.vaxclinic.product.purchase.PurchaseDtos.Actor;
import org.springframework.stereotype.Service;

import java.util.UUID;

/**
 * Phiếu kiểm kho cho màn hình: gọi {@link StockTakeService} (transaction riêng) rồi đọc lại phiếu và ghi lịch sử thao tác
 * sau khi đã commit.
 */
@Service
public class StockTakeManageService {

    private static final String FEATURE = "Kiểm kho";

    private final StockTakeService service;
    private final InventoryDocListRepository listQuery;
    private final InventoryDocMapper mapper;
    private final AuditLogger audit;

    public StockTakeManageService(StockTakeService service, InventoryDocListRepository listQuery, InventoryDocMapper mapper,
                                  AuditLogger audit) {
        this.service = service;
        this.listQuery = listQuery;
        this.mapper = mapper;
        this.audit = audit;
    }

    public PageResponse<TakeListItem> list(InventoryDocListRepository.Filter filter) {
        return listQuery.takes(filter);
    }

    public TakeResponse get(UUID id) {
        service.find(id);
        return mapper.take(id);
    }

    public TakeResponse create(TakeRequest req, boolean complete, Actor actor) {
        UUID id = service.save(null, req, complete, actor);
        return log(actor, mapper.take(id), complete ? "Cân bằng kho" : "Lưu tạm");
    }

    public TakeResponse update(UUID id, TakeRequest req, boolean complete, Actor actor) {
        service.save(id, req, complete, actor);
        return log(actor, mapper.take(id), complete ? "Cân bằng kho" : "Lưu tạm");
    }

    public TakeResponse complete(UUID id, Actor actor) {
        service.complete(id, actor);
        return log(actor, mapper.take(id), "Cân bằng kho");
    }

    public TakeResponse cancel(UUID id, Actor actor) {
        service.cancel(id);
        return log(actor, mapper.take(id), "Hủy");
    }

    /** Ghi lịch sử thao tác (Thiết lập → Lịch sử thao tác). */
    private TakeResponse log(Actor actor, TakeResponse t, String action) {
        audit.record(actor.id(), actor.name(), t.branchId(), FEATURE, action,
                t.code(), action + " phiếu kiểm kho " + t.code() + ", lệch tăng " + t.increaseQuantity().stripTrailingZeros().toPlainString()
                        + ", lệch giảm " + t.decreaseQuantity().stripTrailingZeros().toPlainString()
                        + ", tổng chênh lệch " + String.format("%,.0f", t.diffValue()));
        return t;
    }
}
