package com.vaxclinic.product.purchase;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.product.product.Product;
import com.vaxclinic.product.purchase.PurchaseDtos.Actor;
import com.vaxclinic.product.purchase.PurchaseDtos.ReceiptInfoRequest;
import com.vaxclinic.product.purchase.PurchaseDtos.ReceiptRequest;
import com.vaxclinic.product.stock.StockLedgerEntry.DocType;
import com.vaxclinic.product.stock.StockMovementService;
import com.vaxclinic.product.stock.StockMovementService.Movement;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * Vòng đời phiếu nhập:
 * - Lưu tạm (DRAFT): sửa thoải mái, chưa ảnh hưởng kho.
 * - Hoàn thành (COMPLETED): cộng kho theo đơn vị cơ bản (+ lô), cập nhật giá vốn bình quân, ghi thẻ kho.
 * - Hủy (CANCELLED): phiếu tạm hủy luôn; phiếu đã nhập thì trừ lại kho (không đủ tồn → không cho hủy).
 */
@Service
public class PurchaseReceiptService {

    private final PurchaseReceiptRepository receipts;
    private final PurchaseReturnRepository returns;
    private final PurchaseLineSupport support;
    private final StockMovementService stock;
    private final CashflowOutbox cashflows;

    public PurchaseReceiptService(PurchaseReceiptRepository receipts, PurchaseReturnRepository returns,
                                  PurchaseLineSupport support, StockMovementService stock, CashflowOutbox cashflows) {
        this.receipts = receipts;
        this.returns = returns;
        this.support = support;
        this.stock = stock;
        this.cashflows = cashflows;
    }

    /** Tạo mới (id = null) hoặc sửa phiếu tạm; complete = true thì nhập kho luôn. */
    @Transactional
    public UUID save(UUID id, ReceiptRequest req, boolean complete, Actor actor) {
        PurchaseReceipt r = id == null ? newReceipt(actor) : find(id);
        if (r.getStatus() != DocStatus.DRAFT) {
            throw BusinessException.badRequest("RECEIPT_NOT_DRAFT", "Chỉ sửa được phiếu tạm");
        }
        support.checkBranch(actor, req.branchId());
        support.supplierOrNull(req.supplierId());
        r.setBranchId(req.branchId());
        r.setSupplierId(req.supplierId());
        r.setReceivedAt(req.receivedAt() == null ? Instant.now() : req.receivedAt());
        r.setReceiverId(req.receiverId() == null ? actor.id() : req.receiverId());
        r.setReceiverName(req.receiverId() == null ? actor.name() : req.receiverName());
        r.setInputInvoiceNo(PurchaseLineSupport.blankToNull(req.inputInvoiceNo()));
        r.setVatRate(req.vatRate());
        r.setPaymentMethod(PurchaseLineSupport.blankToNull(req.paymentMethod()));
        r.setNote(req.note());
        applyLines(r, req, complete);
        r.setUpdatedAt(Instant.now());
        // New entity with assigned UUID → Spring Data merges and returns a managed COPY; keep using that copy,
        // otherwise later changes (status COMPLETED) are made on a detached object and silently lost.
        r = receipts.saveAndFlush(r);
        if (complete) {
            complete(r);
        }
        return r.getId();
    }

    @Transactional
    public void updateInfo(UUID id, ReceiptInfoRequest req) {
        PurchaseReceipt r = find(id);
        if (r.getStatus() == DocStatus.CANCELLED) {
            throw BusinessException.badRequest("RECEIPT_CANCELLED", "Phiếu đã hủy");
        }
        if (req.receivedAt() != null) {
            r.setReceivedAt(req.receivedAt());
        }
        if (req.receiverId() != null) {
            r.setReceiverId(req.receiverId());
            r.setReceiverName(req.receiverName());
        }
        r.setInputInvoiceNo(PurchaseLineSupport.blankToNull(req.inputInvoiceNo()));
        r.setNote(req.note());
        r.setUpdatedAt(Instant.now());
    }

    @Transactional
    public void cancel(UUID id, Actor actor) {
        PurchaseReceipt r = find(id);
        if (r.getStatus() == DocStatus.CANCELLED) {
            return;
        }
        if (r.getStatus() == DocStatus.COMPLETED) {
            if (returns.existsByReceiptIdAndStatusNot(id, DocStatus.CANCELLED)) {
                throw BusinessException.badRequest("RECEIPT_HAS_RETURNS", "Phiếu đã có trả hàng nhập, hãy hủy phiếu trả trước");
            }
            support.checkBranch(actor, r.getBranchId());
            Map<UUID, Product> cache = support.newCache();
            for (var line : r.getLines()) {
                Product p = support.product(cache, line.getProductId());
                BigDecimal baseQty = line.getQuantity().multiply(line.getConversionRate());
                stock.apply(p, new Movement(r.getBranchId(), baseQty.negate(), line.getLotNumber(), null,
                        DocType.PURCHASE_CANCEL, r.getId(), r.getCode(), lineCost(r, line), supplierName(r), actor.id()));
            }
            cashflows.receiptCancelled(r);
        }
        r.setStatus(DocStatus.CANCELLED);
        r.setCancelledAt(Instant.now());
        r.setUpdatedAt(Instant.now());
    }

    PurchaseReceipt find(UUID id) {
        return receipts.findById(id)
                .orElseThrow(() -> BusinessException.notFound("RECEIPT_NOT_FOUND", "Không tìm thấy phiếu nhập"));
    }

    private PurchaseReceipt newReceipt(Actor actor) {
        var r = new PurchaseReceipt();
        r.setId(UUID.randomUUID());
        r.setCode("PN%06d".formatted(receipts.nextCodeNumber()));
        r.setCreatedBy(actor.id());
        r.setCreatedByName(actor.name());
        return r;
    }

    private void applyLines(PurchaseReceipt r, ReceiptRequest req, boolean strict) {
        var inputs = req.lines() == null ? java.util.List.<PurchaseDtos.ReceiptLineInput>of() : req.lines();
        if (strict && inputs.isEmpty()) {
            throw BusinessException.badRequest("RECEIPT_EMPTY", "Phiếu nhập chưa có hàng hóa");
        }
        Map<UUID, Product> cache = support.newCache();
        r.getLines().clear();
        var amounts = new java.util.ArrayList<BigDecimal>();
        int no = 1;
        for (var in : inputs) {
            Product p = support.product(cache, in.productId());
            var unit = support.unit(p, in.unitId());
            BigDecimal disc = in.discount() == null ? BigDecimal.ZERO : in.discount();
            if (disc.compareTo(in.unitPrice()) > 0) {
                throw BusinessException.badRequest("DISCOUNT_TOO_LARGE", p.getName() + ": giảm giá lớn hơn đơn giá");
            }
            String lot = PurchaseLineSupport.blankToNull(in.lotNumber());
            if (strict && p.isLotManaged() && (lot == null || in.expiryDate() == null)) {
                throw BusinessException.badRequest("LOT_REQUIRED", p.getName() + " quản lý theo lô: nhập số lô và hạn sử dụng");
            }
            var line = new PurchaseReceiptLine();
            line.setId(UUID.randomUUID());
            line.setReceipt(r);
            line.setLineNo(no++);
            line.setProductId(p.getId());
            line.setUnitId(unit.getId());
            line.setConversionRate(unit.getConversionRate());
            line.setQuantity(in.quantity());
            line.setUnitPrice(in.unitPrice());
            line.setDiscount(disc);
            line.setLotNumber(p.isLotManaged() ? lot : null);
            line.setExpiryDate(p.isLotManaged() ? in.expiryDate() : null);
            r.getLines().add(line);
            amounts.add(PurchaseMath.lineAmount(in.quantity(), in.unitPrice(), disc));
        }
        var t = PurchaseMath.totals(amounts, req.discount() == null ? BigDecimal.ZERO : req.discount(), req.vatRate());
        r.setSubtotal(t.subtotal());
        r.setDiscount(t.discount());
        r.setVatAmount(t.vatAmount());
        r.setTotal(t.total());
        BigDecimal paid = req.paidAmount() == null ? BigDecimal.ZERO : PurchaseMath.money(req.paidAmount());
        if (paid.compareTo(t.total()) > 0) {
            throw BusinessException.badRequest("PAID_TOO_MUCH", "Tiền trả NCC lớn hơn tổng cộng");
        }
        r.setPaidAmount(paid);
    }

    private void complete(PurchaseReceipt r) {
        Map<UUID, Product> cache = support.newCache();
        for (var line : r.getLines()) {
            Product p = support.product(cache, line.getProductId());
            BigDecimal baseQty = line.getQuantity().multiply(line.getConversionRate());
            stock.apply(p, new Movement(r.getBranchId(), baseQty, line.getLotNumber(), line.getExpiryDate(),
                    DocType.PURCHASE, r.getId(), r.getCode(), lineCost(r, line), supplierName(r), r.getReceiverId()));
        }
        r.setStatus(DocStatus.COMPLETED);
        r.setCompletedAt(Instant.now());
        cashflows.receiptPaid(r, support.supplierOrNull(r.getSupplierId())); // phiếu chi trả NCC → Sổ quỹ
    }

    private static BigDecimal lineCost(PurchaseReceipt r, PurchaseReceiptLine line) {
        var totals = new PurchaseMath.Totals(r.getSubtotal(), r.getDiscount(), r.getVatAmount(), r.getTotal());
        return PurchaseMath.baseUnitCost(line.getUnitPrice(), line.getDiscount(), line.getConversionRate(), totals,
                r.getVatRate());
    }

    private String supplierName(PurchaseReceipt r) {
        Supplier s = support.supplierOrNull(r.getSupplierId());
        return s == null ? null : s.getName();
    }
}
