package com.vaxclinic.product.inventory;

import com.vaxclinic.product.inventory.InventoryDocDtos.IssueLineResponse;
import com.vaxclinic.product.inventory.InventoryDocDtos.IssueResponse;
import com.vaxclinic.product.inventory.InventoryDocDtos.TakeLineResponse;
import com.vaxclinic.product.inventory.InventoryDocDtos.TakeResponse;
import com.vaxclinic.product.product.Product;
import com.vaxclinic.product.product.ProductRepository;
import com.vaxclinic.product.product.ProductUnit;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.RoundingMode;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/** Entity phiếu kiểm kho / xuất hủy / xuất dùng nội bộ → response kèm mã hàng, tên hàng, tên đơn vị. */
@Component
@Transactional(readOnly = true)
public class InventoryDocMapper {

    private final ProductRepository products;
    private final StockTakeRepository takes;
    private final StockIssueRepository issues;

    public InventoryDocMapper(ProductRepository products, StockTakeRepository takes, StockIssueRepository issues) {
        this.products = products;
        this.takes = takes;
        this.issues = issues;
    }

    public TakeResponse take(UUID id) {
        StockTake t = takes.findById(id).orElseThrow();
        Map<UUID, Product> cache = new HashMap<>();
        var lines = t.getLines().stream().map(l -> {
            Product p = cache.computeIfAbsent(l.getProductId(), k -> products.findById(k).orElseThrow());
            ProductUnit base = p.baseUnit();
            return new TakeLineResponse(l.getId(), l.getLineNo(), p.getId(), base.getCode(), p.getName(),
                    base.getUnitName(), p.isLotManaged(), l.getLotNumber(), l.getExpiryDate(), l.getSystemQty(),
                    l.getActualQty(), l.diffQty(), l.getCost(),
                    l.diffQty().multiply(l.getCost()).setScale(0, RoundingMode.HALF_UP));
        }).toList();
        return new TakeResponse(t.getId(), t.getCode(), t.getBranchId(), t.getStatus().name(), t.getTakenAt(),
                t.getBalancedAt(), t.getCreatedBy(), t.getCreatedByName(), t.getNote(), t.getActualQty(),
                t.getActualValue(), t.getDiffValue(), t.getIncreaseQty(), t.getDecreaseQty(), lines);
    }

    public IssueResponse issue(UUID id) {
        StockIssue d = issues.findById(id).orElseThrow();
        Map<UUID, Product> cache = new HashMap<>();
        var lines = d.getLines().stream().map(l -> {
            Product p = cache.computeIfAbsent(l.getProductId(), k -> products.findById(k).orElseThrow());
            ProductUnit u = p.getUnits().stream().filter(x -> x.getId().equals(l.getUnitId())).findFirst()
                    .orElseGet(p::baseUnit); // đơn vị đã bị xóa khỏi hàng → hiển thị theo đơn vị cơ bản
            return new IssueLineResponse(l.getId(), l.getLineNo(), p.getId(), u.getCode(), p.getName(), l.getUnitId(),
                    u.getUnitName(), l.getConversionRate(), l.getQuantity(), l.getUnitCost(),
                    l.getQuantity().multiply(l.getUnitCost()).setScale(0, RoundingMode.HALF_UP),
                    l.getLotNumber(), l.getExpiryDate());
        }).toList();
        return new IssueResponse(d.getId(), d.getCode(), d.getType().name(), d.getBranchId(), d.getStatus().name(),
                d.getIssuedAt(), d.getCreatedBy(), d.getCreatedByName(), d.getReason(), d.getNote(), d.getTotalQty(),
                d.getTotalValue(), d.getCompletedAt(), d.getCancelledAt(), lines);
    }
}
