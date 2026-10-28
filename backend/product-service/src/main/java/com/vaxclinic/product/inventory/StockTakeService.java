package com.vaxclinic.product.inventory;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.product.inventory.InventoryDocDtos.TakeLineInput;
import com.vaxclinic.product.inventory.InventoryDocDtos.TakeRequest;
import com.vaxclinic.product.product.Product;
import com.vaxclinic.product.purchase.PurchaseDtos.Actor;
import com.vaxclinic.product.purchase.PurchaseLineSupport;
import com.vaxclinic.product.stock.ProductLotRepository;
import com.vaxclinic.product.stock.StockBalance;
import com.vaxclinic.product.stock.StockBalanceRepository;
import com.vaxclinic.product.stock.StockLedgerEntry.DocType;
import com.vaxclinic.product.stock.StockMovementService;
import com.vaxclinic.product.stock.StockMovementService.Movement;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Kiểm kho: lưu tạm chụp tồn kho hiện tại; "Hoàn thành" (cân bằng kho) chụp lại tồn dưới khóa dòng rồi ghi thẻ kho
 * ADJUSTMENT (+/−) để tồn = thực tế. Hàng theo lô kiểm từng lô. Dòng chưa kiểm (actual null) giữ nguyên tồn.
 */
@Service
public class StockTakeService {

    private final StockTakeRepository takes;
    private final PurchaseLineSupport support;
    private final StockMovementService stock;
    private final StockBalanceRepository balances;
    private final ProductLotRepository lots;

    public StockTakeService(StockTakeRepository takes, PurchaseLineSupport support, StockMovementService stock,
                            StockBalanceRepository balances, ProductLotRepository lots) {
        this.takes = takes;
        this.support = support;
        this.stock = stock;
        this.balances = balances;
        this.lots = lots;
    }

    @Transactional
    public UUID save(UUID id, TakeRequest req, boolean balance, Actor actor) {
        StockTake t = id == null ? newTake(actor) : find(id);
        if (t.getStatus() != StockTake.Status.DRAFT) {
            throw BusinessException.badRequest("TAKE_NOT_DRAFT", "Phiếu kiểm kho đã cân bằng hoặc đã hủy: không sửa được");
        }
        support.checkBranch(actor, req.branchId());
        t.setBranchId(req.branchId());
        t.setNote(req.note());
        Map<UUID, Product> cache = support.newCache();
        applyLines(t, req.lines() == null ? List.of() : req.lines(), cache);
        if (balance && t.getLines().stream().noneMatch(l -> l.getActualQty() != null)) {
            throw BusinessException.badRequest("TAKE_EMPTY", "Phiếu kiểm kho chưa có hàng hóa nào được kiểm");
        }
        if (balance) {
            Instant now = Instant.now();
            support.checkNotLocked(t.getBranchId(), now);
            balanceStock(t, cache, actor);
            t.setStatus(StockTake.Status.BALANCED);
            t.setBalancedAt(now);
        }
        recomputeTotals(t);
        t.setUpdatedAt(Instant.now());
        return takes.saveAndFlush(t).getId();
    }

    /** "Hoàn thành" phiếu tạm đã lưu, giữ nguyên các dòng đã nhập. */
    @Transactional
    public UUID complete(UUID id, Actor actor) {
        StockTake t = find(id);
        var lines = t.getLines().stream().map(l -> new TakeLineInput(l.getProductId(), l.getLotNumber(), l.getExpiryDate(),
                l.getActualQty())).toList();
        return save(id, new TakeRequest(t.getBranchId(), t.getNote(), lines), true, actor);
    }

    @Transactional
    public void cancel(UUID id) {
        StockTake t = find(id);
        if (t.getStatus() != StockTake.Status.DRAFT) {
            throw BusinessException.badRequest("TAKE_NOT_CANCELLABLE", "Chỉ hủy được phiếu kiểm kho tạm");
        }
        t.setStatus(StockTake.Status.CANCELLED);
        t.setCancelledAt(Instant.now());
        t.setUpdatedAt(Instant.now());
    }

    StockTake find(UUID id) {
        return takes.findById(id)
                .orElseThrow(() -> BusinessException.notFound("TAKE_NOT_FOUND", "Không tìm thấy phiếu kiểm kho"));
    }

    private StockTake newTake(Actor actor) {
        var t = new StockTake();
        t.setId(UUID.randomUUID());
        t.setCode("KK%06d".formatted(takes.nextCodeNumber()));
        t.setTakenAt(Instant.now());
        t.setCreatedBy(actor.id());
        t.setCreatedByName(actor.name());
        return t;
    }

    /** Dựng lại dòng từ request + chụp tồn kho / giá vốn hiện tại (chưa khóa — chỉ để hiển thị phiếu tạm). */
    private void applyLines(StockTake t, List<TakeLineInput> inputs, Map<UUID, Product> cache) {
        t.getLines().clear();
        var seen = new HashSet<String>();
        int no = 1;
        for (var in : inputs) {
            Product p = support.product(cache, in.productId());
            String lot = p.isLotManaged() ? PurchaseLineSupport.blankToNull(in.lotNumber()) : null;
            if (p.isLotManaged() && lot == null) {
                throw BusinessException.badRequest("LOT_REQUIRED", p.getName() + " quản lý theo lô: nhập số lô cần kiểm");
            }
            if (!seen.add(p.getId() + "|" + lot)) {
                throw BusinessException.badRequest("DUPLICATE_LINE",
                        p.getName() + (lot == null ? "" : " lô " + lot) + " bị lặp trên phiếu kiểm kho");
            }
            var line = new StockTakeLine();
            line.setId(UUID.randomUUID());
            line.setStockTake(t);
            line.setLineNo(no++);
            line.setProductId(p.getId());
            line.setLotNumber(lot);
            line.setExpiryDate(in.expiryDate());
            if (lot != null) {
                lots.findByProductIdAndBranchIdAndLotNumber(p.getId(), t.getBranchId(), lot)
                        .ifPresent(l -> line.setExpiryDate(l.getExpiryDate()));
            }
            line.setSystemQty(currentQty(p, t.getBranchId(), lot, false));
            line.setActualQty(in.actualQuantity());
            line.setCost(p.getCost());
            t.getLines().add(line);
        }
    }

    /** Cân bằng: khóa dòng tồn / lô, chụp lại tồn tại thời điểm cân bằng, ghi chênh lệch vào thẻ kho. */
    private void balanceStock(StockTake t, Map<UUID, Product> cache, Actor actor) {
        for (var line : t.getLines()) {
            if (line.getActualQty() == null) {
                continue;
            }
            Product p = support.product(cache, line.getProductId());
            line.setSystemQty(currentQty(p, t.getBranchId(), line.getLotNumber(), true));
            line.setCost(p.getCost());
            BigDecimal diff = line.diffQty();
            boolean newLot = line.getLotNumber() != null && line.getSystemQty().signum() == 0
                    && lots.findByProductIdAndBranchIdAndLotNumber(p.getId(), t.getBranchId(), line.getLotNumber()).isEmpty();
            stock.apply(p, new Movement(t.getBranchId(), diff, line.getLotNumber(), newLot ? line.getExpiryDate() : null,
                    DocType.ADJUSTMENT, t.getId(), t.getCode(), p.getCost(), null, actor.id()));
        }
    }

    private BigDecimal currentQty(Product p, UUID branchId, String lot, boolean lock) {
        if (lot != null) {
            var found = lock ? lots.findForUpdate(p.getId(), branchId, lot)
                    : lots.findByProductIdAndBranchIdAndLotNumber(p.getId(), branchId, lot);
            return found.map(l -> l.getQuantity()).orElse(BigDecimal.ZERO);
        }
        var key = new StockBalance.Key(p.getId(), branchId);
        var found = lock ? balances.findForUpdate(key) : balances.findById(key);
        return found.map(StockBalance::getQuantity).orElse(BigDecimal.ZERO);
    }

    private static void recomputeTotals(StockTake t) {
        BigDecimal actualQty = BigDecimal.ZERO, actualValue = BigDecimal.ZERO, diffValue = BigDecimal.ZERO;
        BigDecimal inc = BigDecimal.ZERO, dec = BigDecimal.ZERO;
        for (var l : t.getLines()) {
            if (l.getActualQty() == null) {
                continue;
            }
            BigDecimal diff = l.diffQty();
            actualQty = actualQty.add(l.getActualQty());
            actualValue = actualValue.add(l.getActualQty().multiply(l.getCost()));
            diffValue = diffValue.add(diff.multiply(l.getCost()));
            if (diff.signum() > 0) {
                inc = inc.add(diff);
            } else {
                dec = dec.add(diff.negate());
            }
        }
        t.setActualQty(actualQty);
        t.setActualValue(actualValue.setScale(0, RoundingMode.HALF_UP));
        t.setDiffValue(diffValue.setScale(0, RoundingMode.HALF_UP));
        t.setIncreaseQty(inc);
        t.setDecreaseQty(dec);
    }
}
