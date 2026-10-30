package com.vaxclinic.product.purchase;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.product.product.Product;
import com.vaxclinic.product.purchase.PurchaseDtos.Actor;
import com.vaxclinic.product.purchase.PurchaseDtos.ReceiptLineInput;
import com.vaxclinic.product.purchase.PurchaseDtos.ReceiptRequest;
import com.vaxclinic.product.stock.StockLedgerEntry.DocType;
import com.vaxclinic.product.stock.StockMovementService;
import com.vaxclinic.product.stock.StockMovementService.Movement;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * "Mở phiếu" trên phiếu ĐÃ NHẬP (KiotViet: chỉ 1 nút Lưu): sửa NCC, giảm giá, VAT, ghi chú, người nhập, ngày nhập và
 * SL / đơn giá / giảm giá / VAT% của từng dòng. Không thêm / bớt dòng, không đổi hàng / đơn vị / lô; tiền trả NCC khóa;
 * số HĐ đầu vào giữ nguyên (sửa ở "Sửa thông tin").
 * Ghi lại:
 * - kho: mỗi dòng đổi SL hoặc giá vốn → thẻ kho PURCHASE_ADJUST (+SL mới theo giá vốn mới rồi −SL cũ theo giá vốn cũ;
 *   chỉ đổi SL thì 1 dòng chênh lệch), theo NGÀY PHIẾU (lùi ngày được, tồn sau giao dịch tính lại) → giá vốn bình quân
 *   = (giá trị tồn + giá trị mới − giá trị cũ) / tồn sau;
 * - công nợ NCC: sổ nợ đọc tổng cộng của phiếu nên tự đổi; đổi NCC → phiếu chi PC{mã} chuyển NCC, phân bổ khác giải phóng;
 * - Sổ quỹ: tiền trả không đổi; chỉ cập nhật ngày / người nhận của phiếu chi PC{mã}.
 */
@Service
public class PurchaseReceiptAdjustService {

    private final PurchaseReceiptService receiptService;
    private final PurchaseReturnRepository returns;
    private final PurchaseReceiptRepository receipts;
    private final PurchaseLineSupport support;
    private final PurchaseReceiptLines lines;
    private final StockMovementService stock;
    private final SupplierDebtService debts;

    public PurchaseReceiptAdjustService(PurchaseReceiptService receiptService, PurchaseReturnRepository returns,
                                        PurchaseReceiptRepository receipts, PurchaseLineSupport support,
                                        PurchaseReceiptLines lines, StockMovementService stock, SupplierDebtService debts) {
        this.receiptService = receiptService;
        this.returns = returns;
        this.receipts = receipts;
        this.support = support;
        this.lines = lines;
        this.stock = stock;
        this.debts = debts;
    }

    private record Snapshot(BigDecimal baseQty, BigDecimal cost) {
    }

    @Transactional
    public UUID adjust(UUID id, ReceiptRequest req, Actor actor) {
        PurchaseReceipt r = receiptService.find(id);
        if (r.getStatus() != DocStatus.COMPLETED) {
            throw BusinessException.badRequest("RECEIPT_NOT_COMPLETED", "Chỉ dùng để sửa phiếu đã nhập hàng");
        }
        if (returns.existsByReceiptIdAndStatusNot(id, DocStatus.CANCELLED)) {
            throw BusinessException.badRequest("RECEIPT_HAS_RETURNS", "Phiếu đã có trả hàng nhập, hãy hủy phiếu trả trước khi sửa");
        }
        support.checkBranch(actor, r.getBranchId());
        Instant oldAt = r.getReceivedAt();
        Instant at = req.receivedAt() == null ? oldAt : req.receivedAt();
        support.checkNotLocked(r.getBranchId(), oldAt);
        support.checkNotLocked(r.getBranchId(), at);
        UUID oldSupplier = r.getSupplierId();
        Supplier supplier = support.supplierOrNull(req.supplierId());
        if (supplier != null && !supplier.isActive() && !supplier.getId().equals(oldSupplier)) {
            throw BusinessException.badRequest("SUPPLIER_INACTIVE", "Nhà cung cấp " + supplier.getName() + " đã ngừng hoạt động");
        }
        if (r.getPaidAmount().signum() > 0) {
            PurchaseReceiptService.checkPaidSupplierChange(oldSupplier, req.supplierId());
        }

        Map<UUID, Snapshot> before = new HashMap<>();
        r.getLines().forEach(l -> before.put(l.getId(), new Snapshot(base(l), PurchaseReceiptLines.lineCost(r, l))));
        Map<UUID, ReceiptLineInput> inputs = new HashMap<>();
        (req.lines() == null ? java.util.List.<ReceiptLineInput>of() : req.lines()).forEach(in -> inputs.put(in.id(), in));
        if (inputs.size() != r.getLines().size() || !inputs.keySet().equals(before.keySet())) {
            throw BusinessException.badRequest("ADJUST_LINES_MISMATCH",
                    "Không thêm / bớt dòng hàng khi sửa phiếu đã nhập (hãy hủy phiếu và lập phiếu mới)");
        }
        Map<UUID, Product> cache = support.newCache();
        for (var l : r.getLines()) {
            lines.setValues(l, inputs.get(l.getId()), req, support.product(cache, l.getProductId()).getName());
        }
        lines.applyTotals(r, req);
        r.setSupplierId(req.supplierId());
        r.setReceivedAt(at);
        if (req.receiverId() != null) {
            r.setReceiverId(req.receiverId());
            r.setReceiverName(req.receiverName());
        }
        r.setNote(req.note());
        r.setUpdatedAt(Instant.now());
        if (!java.util.Objects.equals(oldSupplier, r.getSupplierId())) {
            debts.receiptSupplierChanged(r); // trước khi so tổng với số đã trả: phân bổ của NCC cũ đã được giải phóng
        }
        BigDecimal settled = debts.receiptSettled(r.getId());
        if (r.getTotal().compareTo(settled) < 0) {
            throw BusinessException.badRequest("ADJUST_BELOW_PAID", "Tổng cộng mới (" + String.format("%,.0f", r.getTotal())
                    + ") nhỏ hơn số đã trả / chiết khấu cho nhà cung cấp (" + String.format("%,.0f", settled) + ")");
        }
        PurchaseReceipt saved = receipts.saveAndFlush(r);
        if (!at.equals(oldAt)) {
            stock.redate(saved.getId(), at);
        }
        String partner = supplier == null ? null : supplier.getName();
        for (var l : saved.getLines()) {
            Snapshot old = before.get(l.getId());
            BigDecimal newBase = base(l);
            BigDecimal newCost = PurchaseReceiptLines.lineCost(saved, l);
            Product p = support.product(cache, l.getProductId());
            if (newCost.compareTo(old.cost()) == 0) {
                BigDecimal delta = newBase.subtract(old.baseQty());
                if (delta.signum() != 0) {
                    move(saved, l, p, delta, newCost, partner, actor, at);
                }
                continue;
            }
            // giá vốn dòng đổi: nhập SL mới theo giá mới trước, rồi bỏ SL cũ theo giá cũ (tồn không xuống âm giữa chừng)
            move(saved, l, p, newBase, newCost, partner, actor, at);
            move(saved, l, p, old.baseQty().negate(), old.cost(), partner, actor, at);
        }
        if (saved.isPaymentPosted()) {
            receiptService.voucherFollows(saved, oldSupplier, oldAt, supplier);
        }
        return saved.getId();
    }

    private void move(PurchaseReceipt r, PurchaseReceiptLine l, Product p, BigDecimal qty, BigDecimal cost, String partner,
                      Actor actor, Instant at) {
        stock.apply(p, new Movement(r.getBranchId(), qty, l.getLotNumber(), l.getExpiryDate(), DocType.PURCHASE_ADJUST,
                r.getId(), r.getCode(), cost, partner, actor.id(), at));
    }

    private static BigDecimal base(PurchaseReceiptLine l) {
        return l.getQuantity().multiply(l.getConversionRate());
    }
}
