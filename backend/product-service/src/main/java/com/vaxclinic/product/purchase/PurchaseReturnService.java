package com.vaxclinic.product.purchase;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.product.product.Product;
import com.vaxclinic.product.purchase.PurchaseDtos.Actor;
import com.vaxclinic.product.purchase.PurchaseDtos.ReturnRequest;
import com.vaxclinic.product.stock.StockLedgerEntry.DocType;
import com.vaxclinic.product.stock.StockMovementService;
import com.vaxclinic.product.stock.StockMovementService.Movement;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/**
 * Trả hàng nhập: hoàn thành → trừ kho (theo lô), giá vốn bình quân tính lại theo giá trả, ghi thẻ kho.
 * Trả theo phiếu nhập: không được trả quá số đã nhập (theo hàng + lô) trừ đi các lần trả trước.
 */
@Service
public class PurchaseReturnService {

    private final PurchaseReturnRepository returns;
    private final PurchaseReceiptRepository receipts;
    private final PurchaseLineSupport support;
    private final StockMovementService stock;

    public PurchaseReturnService(PurchaseReturnRepository returns, PurchaseReceiptRepository receipts,
                                 PurchaseLineSupport support, StockMovementService stock) {
        this.returns = returns;
        this.receipts = receipts;
        this.support = support;
        this.stock = stock;
    }

    @Transactional
    public UUID save(UUID id, ReturnRequest req, boolean complete, Actor actor) {
        PurchaseReturn r = id == null ? newReturn(actor) : find(id);
        if (r.getStatus() != DocStatus.DRAFT) {
            throw BusinessException.badRequest("RETURN_NOT_DRAFT", "Chỉ sửa được phiếu tạm");
        }
        support.checkBranch(actor, req.branchId());
        UUID supplierId = req.supplierId();
        if (req.receiptId() != null) {
            var receipt = receipts.findById(req.receiptId())
                    .orElseThrow(() -> BusinessException.badRequest("RECEIPT_NOT_FOUND", "Phiếu nhập không tồn tại"));
            if (receipt.getStatus() != DocStatus.COMPLETED || !receipt.getBranchId().equals(req.branchId())) {
                throw BusinessException.badRequest("RECEIPT_NOT_RETURNABLE", "Chỉ trả theo phiếu đã nhập tại cùng chi nhánh");
            }
            supplierId = receipt.getSupplierId();
        }
        support.supplierOrNull(supplierId);
        r.setBranchId(req.branchId());
        r.setSupplierId(supplierId);
        r.setReceiptId(req.receiptId());
        r.setReturnedAt(req.returnedAt() == null ? Instant.now() : req.returnedAt());
        r.setReturnerId(req.returnerId() == null ? actor.id() : req.returnerId());
        r.setReturnerName(req.returnerId() == null ? actor.name() : req.returnerName());
        r.setVatRate(req.vatRate());
        r.setNote(req.note());
        applyLines(r, req, complete);
        r.setUpdatedAt(Instant.now());
        r = returns.saveAndFlush(r); // keep the managed copy (see PurchaseReceiptService.save)
        if (complete) {
            support.checkNotLocked(r.getBranchId(), r.getReturnedAt());
            if (r.getReceiptId() != null) {
                checkNotOverReturned(r);
            }
            move(r, false, actor);
            r.setStatus(DocStatus.COMPLETED);
            r.setCompletedAt(Instant.now());
        }
        return r.getId();
    }

    @Transactional
    public void cancel(UUID id, Actor actor) {
        PurchaseReturn r = find(id);
        if (r.getStatus() == DocStatus.COMPLETED) {
            support.checkBranch(actor, r.getBranchId());
            support.checkNotLocked(r.getBranchId(), r.getReturnedAt());
            move(r, true, actor); // nhập lại kho số đã trả
        }
        r.setStatus(DocStatus.CANCELLED);
        r.setCancelledAt(Instant.now());
        r.setUpdatedAt(Instant.now());
    }

    PurchaseReturn find(UUID id) {
        return returns.findById(id)
                .orElseThrow(() -> BusinessException.notFound("RETURN_NOT_FOUND", "Không tìm thấy phiếu trả hàng nhập"));
    }

    private PurchaseReturn newReturn(Actor actor) {
        var r = new PurchaseReturn();
        r.setId(UUID.randomUUID());
        r.setCode("THN%06d".formatted(returns.nextCodeNumber()));
        r.setCreatedBy(actor.id());
        r.setCreatedByName(actor.name());
        return r;
    }

    private void applyLines(PurchaseReturn r, ReturnRequest req, boolean strict) {
        var inputs = req.lines() == null ? List.<PurchaseDtos.ReturnLineInput>of() : req.lines();
        if (strict && inputs.isEmpty()) {
            throw BusinessException.badRequest("RETURN_EMPTY", "Phiếu trả chưa có hàng hóa");
        }
        Map<UUID, Product> cache = support.newCache();
        r.getLines().clear();
        var amounts = new java.util.ArrayList<BigDecimal>();
        int no = 1;
        for (var in : inputs) {
            Product p = support.product(cache, in.productId());
            var unit = support.unit(p, in.unitId());
            String lot = PurchaseLineSupport.blankToNull(in.lotNumber());
            if (strict && p.isLotManaged() && lot == null) {
                throw BusinessException.badRequest("LOT_REQUIRED", p.getName() + " quản lý theo lô: chọn lô trả");
            }
            var line = new PurchaseReturnLine();
            line.setId(UUID.randomUUID());
            line.setPurchaseReturn(r);
            line.setLineNo(no++);
            line.setProductId(p.getId());
            line.setUnitId(unit.getId());
            line.setConversionRate(unit.getConversionRate());
            line.setQuantity(in.quantity());
            line.setUnitPrice(in.unitPrice());
            line.setLotNumber(p.isLotManaged() ? lot : null);
            r.getLines().add(line);
            amounts.add(PurchaseMath.lineAmount(in.quantity(), in.unitPrice(), BigDecimal.ZERO));
        }
        var t = PurchaseMath.totals(amounts, req.discount() == null ? BigDecimal.ZERO : req.discount(), req.vatRate());
        r.setSubtotal(t.subtotal());
        r.setDiscount(t.discount());
        r.setVatAmount(t.vatAmount());
        r.setTotal(t.total());
        BigDecimal refund = req.refundAmount() == null ? BigDecimal.ZERO : PurchaseMath.money(req.refundAmount());
        if (refund.compareTo(t.total()) > 0) {
            throw BusinessException.badRequest("REFUND_TOO_MUCH", "Tiền NCC trả lớn hơn tổng cộng");
        }
        r.setRefundAmount(refund);
    }

    /** Σ đã trả (các phiếu hoàn thành khác + phiếu này) ≤ đã nhập, theo (hàng, lô), tính bằng đơn vị cơ bản. */
    private void checkNotOverReturned(PurchaseReturn r) {
        Map<String, BigDecimal> received = new HashMap<>();
        receipts.findById(r.getReceiptId()).orElseThrow().getLines().forEach(l ->
                received.merge(key(l.getProductId(), l.getLotNumber()), l.getQuantity().multiply(l.getConversionRate()), BigDecimal::add));
        Map<String, BigDecimal> returned = new HashMap<>();
        returns.findByReceiptIdAndStatus(r.getReceiptId(), DocStatus.COMPLETED).stream()
                .filter(x -> !x.getId().equals(r.getId()))
                .flatMap(x -> x.getLines().stream())
                .forEach(l -> returned.merge(key(l.getProductId(), l.getLotNumber()), l.getQuantity().multiply(l.getConversionRate()), BigDecimal::add));
        r.getLines().forEach(l -> returned.merge(key(l.getProductId(), l.getLotNumber()), l.getQuantity().multiply(l.getConversionRate()), BigDecimal::add));
        returned.forEach((k, qty) -> {
            if (qty.compareTo(received.getOrDefault(k, BigDecimal.ZERO)) > 0) {
                throw BusinessException.badRequest("RETURN_EXCEEDS_RECEIPT", "Số lượng trả vượt số lượng đã nhập trong phiếu");
            }
        });
    }

    private static String key(UUID productId, String lot) {
        return productId + "|" + Objects.toString(lot, "");
    }

    /** Hoàn thành: xuất kho. Hủy phiếu đã trả (reverse = true): nhập lại kho. Giá vốn tính theo giá trả gồm VAT. */
    private void move(PurchaseReturn r, boolean reverse, Actor actor) {
        Map<UUID, Product> cache = support.newCache();
        Supplier s = support.supplierOrNull(r.getSupplierId());
        var totals = new PurchaseMath.Totals(r.getSubtotal(), r.getDiscount(), r.getVatAmount(), r.getTotal());
        for (var line : r.getLines()) {
            Product p = support.product(cache, line.getProductId());
            BigDecimal baseQty = line.getQuantity().multiply(line.getConversionRate());
            BigDecimal cost = PurchaseMath.baseUnitCost(line.getUnitPrice(), BigDecimal.ZERO, line.getConversionRate(),
                    totals, r.getVatRate());
            stock.apply(p, new Movement(r.getBranchId(), reverse ? baseQty : baseQty.negate(), line.getLotNumber(), null,
                    reverse ? DocType.PURCHASE_RETURN_CANCEL : DocType.PURCHASE_RETURN, r.getId(), r.getCode(), cost,
                    s == null ? null : s.getName(), actor.id(), r.getReturnedAt())); // thẻ kho theo ngày trả (lùi ngày được)
        }
    }
}
