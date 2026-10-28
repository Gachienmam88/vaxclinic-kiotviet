package com.vaxclinic.product.inventory;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.product.inventory.InventoryDocDtos.IssueRequest;
import com.vaxclinic.product.product.Product;
import com.vaxclinic.product.purchase.DocStatus;
import com.vaxclinic.product.purchase.PurchaseDtos.Actor;
import com.vaxclinic.product.purchase.PurchaseLineSupport;
import com.vaxclinic.product.stock.ProductLotRepository;
import com.vaxclinic.product.stock.StockMovementService;
import com.vaxclinic.product.stock.StockMovementService.Movement;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Xuất hủy / xuất dùng nội bộ: hoàn thành → trừ kho theo giá vốn hiện tại (theo lô, kể cả lô đã hết hạn — vắc xin
 * hết hạn phải xuất hủy). Hủy phiếu đã hoàn thành → nhập lại đúng số lượng, đúng lô.
 */
@Service
public class StockIssueService {

    private final StockIssueRepository issues;
    private final PurchaseLineSupport support;
    private final StockMovementService stock;
    private final ProductLotRepository lots;

    public StockIssueService(StockIssueRepository issues, PurchaseLineSupport support, StockMovementService stock,
                             ProductLotRepository lots) {
        this.issues = issues;
        this.support = support;
        this.stock = stock;
        this.lots = lots;
    }

    @Transactional
    public UUID save(StockIssue.Type type, UUID id, IssueRequest req, boolean complete, Actor actor) {
        StockIssue d = id == null ? newIssue(type, actor) : find(type, id);
        if (d.getStatus() != DocStatus.DRAFT) {
            throw BusinessException.badRequest("ISSUE_NOT_DRAFT", "Chỉ sửa được phiếu tạm");
        }
        support.checkBranch(actor, req.branchId());
        d.setBranchId(req.branchId());
        d.setIssuedAt(req.issuedAt() == null ? Instant.now() : req.issuedAt());
        d.setReason(PurchaseLineSupport.blankToNull(req.reason()));
        d.setNote(req.note());
        Map<UUID, Product> cache = support.newCache();
        applyLines(d, req, complete, cache);
        d.setUpdatedAt(Instant.now());
        if (complete) {
            support.checkNotLocked(d.getBranchId(), d.getIssuedAt());
            priceLines(d, cache); // giá vốn tại thời điểm xuất
            move(d, false, cache, actor);
            d.setStatus(DocStatus.COMPLETED);
            d.setCompletedAt(Instant.now());
        }
        return issues.saveAndFlush(d).getId();
    }

    /** "Hoàn thành" phiếu tạm đã lưu, giữ nguyên các dòng đã nhập. */
    @Transactional
    public UUID complete(StockIssue.Type type, UUID id, Actor actor) {
        StockIssue d = find(type, id);
        var lines = d.getLines().stream().map(l -> new InventoryDocDtos.IssueLineInput(l.getProductId(), l.getUnitId(),
                l.getQuantity(), l.getLotNumber())).toList();
        return save(type, id, new IssueRequest(d.getBranchId(), d.getIssuedAt(), d.getReason(), d.getNote(), lines), true, actor);
    }

    @Transactional
    public void cancel(StockIssue.Type type, UUID id, Actor actor) {
        StockIssue d = find(type, id);
        if (d.getStatus() == DocStatus.CANCELLED) {
            throw BusinessException.badRequest("ISSUE_CANCELLED", "Phiếu đã hủy");
        }
        if (d.getStatus() == DocStatus.COMPLETED) {
            support.checkBranch(actor, d.getBranchId());
            support.checkNotLocked(d.getBranchId(), d.getIssuedAt());
            move(d, true, support.newCache(), actor); // nhập lại kho số đã xuất
        }
        d.setStatus(DocStatus.CANCELLED);
        d.setCancelledAt(Instant.now());
        d.setUpdatedAt(Instant.now());
    }

    StockIssue find(StockIssue.Type type, UUID id) {
        return issues.findById(id).filter(d -> d.getType() == type)
                .orElseThrow(() -> BusinessException.notFound("ISSUE_NOT_FOUND", "Không tìm thấy phiếu " + type.label.toLowerCase()));
    }

    private StockIssue newIssue(StockIssue.Type type, Actor actor) {
        var d = new StockIssue();
        d.setId(UUID.randomUUID());
        d.setType(type);
        long no = type == StockIssue.Type.DAMAGE ? issues.nextDamageNumber() : issues.nextInternalNumber();
        d.setCode(type.prefix + "%06d".formatted(no));
        d.setCreatedBy(actor.id());
        d.setCreatedByName(actor.name());
        return d;
    }

    private void applyLines(StockIssue d, IssueRequest req, boolean strict, Map<UUID, Product> cache) {
        var inputs = req.lines() == null ? List.<InventoryDocDtos.IssueLineInput>of() : req.lines();
        if (strict && inputs.isEmpty()) {
            throw BusinessException.badRequest("ISSUE_EMPTY", "Phiếu chưa có hàng hóa");
        }
        d.getLines().clear();
        int no = 1;
        for (var in : inputs) {
            Product p = support.product(cache, in.productId());
            var unit = support.unit(p, in.unitId());
            String lot = p.isLotManaged() ? PurchaseLineSupport.blankToNull(in.lotNumber()) : null;
            if (strict && p.isLotManaged() && lot == null) {
                throw BusinessException.badRequest("LOT_REQUIRED", p.getName() + " quản lý theo lô: chọn lô xuất");
            }
            var line = new StockIssueLine();
            line.setId(UUID.randomUUID());
            line.setIssue(d);
            line.setLineNo(no++);
            line.setProductId(p.getId());
            line.setUnitId(unit.getId());
            line.setConversionRate(unit.getConversionRate());
            line.setQuantity(in.quantity());
            line.setLotNumber(lot);
            if (lot != null) {
                lots.findByProductIdAndBranchIdAndLotNumber(p.getId(), d.getBranchId(), lot)
                        .ifPresent(l -> line.setExpiryDate(l.getExpiryDate()));
            }
            d.getLines().add(line);
        }
        priceLines(d, cache);
    }

    /** Giá vốn dòng = giá vốn cơ bản × quy đổi; tổng giá trị làm tròn đồng. */
    private void priceLines(StockIssue d, Map<UUID, Product> cache) {
        BigDecimal qty = BigDecimal.ZERO, value = BigDecimal.ZERO;
        for (var l : d.getLines()) {
            Product p = support.product(cache, l.getProductId());
            l.setUnitCost(p.getCost().multiply(l.getConversionRate()).setScale(4, RoundingMode.HALF_UP));
            qty = qty.add(l.getQuantity());
            value = value.add(l.getQuantity().multiply(l.getUnitCost()));
        }
        d.setTotalQty(qty);
        d.setTotalValue(value.setScale(0, RoundingMode.HALF_UP));
    }

    private void move(StockIssue d, boolean reverse, Map<UUID, Product> cache, Actor actor) {
        for (var line : d.getLines()) {
            Product p = support.product(cache, line.getProductId());
            BigDecimal baseQty = line.getQuantity().multiply(line.getConversionRate());
            BigDecimal baseCost = line.getUnitCost().divide(line.getConversionRate(), 4, RoundingMode.HALF_UP);
            stock.apply(p, new Movement(d.getBranchId(), reverse ? baseQty : baseQty.negate(), line.getLotNumber(), null,
                    reverse ? d.getType().cancel : d.getType().out, d.getId(), d.getCode(), baseCost, null, actor.id()));
        }
    }
}
