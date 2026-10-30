package com.vaxclinic.product.purchase;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.product.internal.CashflowOutbox;
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
import java.util.Objects;
import java.util.UUID;

/**
 * Vòng đời phiếu nhập:
 * - Lưu tạm (DRAFT): sửa thoải mái, chưa ảnh hưởng kho. Có tiền trả NCC + payNow → lập phiếu chi PC{mã} ngay
 *   (phiếu chi + chứng từ công nợ NCC), sau đó tiền trả bị khóa; Hoàn thành không lập phiếu chi lần 2.
 * - Hoàn thành (COMPLETED): cộng kho theo đơn vị cơ bản (+ lô), cập nhật giá vốn bình quân, ghi thẻ kho.
 * - Hủy (CANCELLED): phiếu tạm hủy luôn (đã lập phiếu chi thì hủy phiếu chi); phiếu đã nhập thì trừ lại kho.
 * Sửa phiếu đã nhập: {@link PurchaseReceiptAdjustService}.
 */
@Service
public class PurchaseReceiptService {

    private final PurchaseReceiptRepository receipts;
    private final PurchaseReturnRepository returns;
    private final PurchaseLineSupport support;
    private final PurchaseReceiptLines lines;
    private final StockMovementService stock;
    private final CashflowOutbox cashflows;
    private final SupplierDebtService debts;

    public PurchaseReceiptService(PurchaseReceiptRepository receipts, PurchaseReturnRepository returns,
                                  PurchaseLineSupport support, PurchaseReceiptLines lines, StockMovementService stock,
                                  CashflowOutbox cashflows, SupplierDebtService debts) {
        this.receipts = receipts;
        this.returns = returns;
        this.support = support;
        this.lines = lines;
        this.stock = stock;
        this.cashflows = cashflows;
        this.debts = debts;
    }

    /** Tạo mới (id = null) hoặc sửa phiếu tạm; complete = true thì nhập kho luôn. */
    @Transactional
    public UUID save(UUID id, ReceiptRequest req, boolean complete, Actor actor) {
        PurchaseReceipt r = id == null ? newReceipt(actor) : find(id);
        if (r.getStatus() != DocStatus.DRAFT) {
            throw BusinessException.badRequest("RECEIPT_NOT_DRAFT", "Chỉ sửa được phiếu tạm");
        }
        support.checkBranch(actor, req.branchId());
        boolean posted = r.isPaymentPosted();
        UUID oldSupplier = r.getSupplierId();
        Instant oldAt = r.getReceivedAt();
        Supplier supplier = support.supplierOrNull(req.supplierId());
        if (supplier != null && !supplier.isActive() && !supplier.getId().equals(oldSupplier)) {
            throw BusinessException.badRequest("SUPPLIER_INACTIVE", "Nhà cung cấp " + supplier.getName() + " đã ngừng hoạt động");
        }
        if (posted) {
            checkPaidSupplierChange(oldSupplier, req.supplierId());
            if (req.branchId() != null && !req.branchId().equals(r.getBranchId())) {
                throw BusinessException.badRequest("BRANCH_LOCKED_PAID", "Phiếu đã lập phiếu chi: không đổi chi nhánh");
            }
        }
        r.setBranchId(req.branchId());
        r.setSupplierId(req.supplierId());
        r.setReceivedAt(req.receivedAt() == null ? Instant.now() : req.receivedAt());
        BigDecimal paid = posted ? r.getPaidAmount()
                : req.paidAmount() == null ? BigDecimal.ZERO : PurchaseMath.money(req.paidAmount());
        boolean payNow = !posted && !complete && Boolean.TRUE.equals(req.payNow()) && paid.signum() > 0;
        if (complete || payNow || posted) {
            support.checkNotLocked(req.branchId(), r.getReceivedAt());
        }
        if (posted && oldAt != null) {
            support.checkNotLocked(r.getBranchId(), oldAt);
        }
        r.setReceiverId(req.receiverId() == null ? actor.id() : req.receiverId());
        r.setReceiverName(req.receiverId() == null ? actor.name() : req.receiverName());
        r.setInputInvoiceNo(PurchaseLineSupport.blankToNull(req.inputInvoiceNo()));
        if (!posted) {
            r.setPaymentMethod(PurchaseLineSupport.blankToNull(req.paymentMethod()));
        }
        r.setNote(req.note());
        lines.replaceLines(r, req, complete);
        lines.applyTotals(r, req);
        if (paid.compareTo(r.getTotal()) > 0) {
            throw BusinessException.badRequest("PAID_TOO_MUCH", "Tiền trả NCC lớn hơn tổng cộng");
        }
        r.setPaidAmount(paid);
        r.setUpdatedAt(Instant.now());
        // New entity with assigned UUID → Spring Data merges and returns a managed COPY; keep using that copy,
        // otherwise later changes (status COMPLETED) are made on a detached object and silently lost.
        r = receipts.saveAndFlush(r);
        if (posted) {
            voucherFollows(r, oldSupplier, oldAt, supplier);
        }
        if (payNow) {
            postPayment(r);
        }
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
        if (r.getStatus() == DocStatus.COMPLETED || r.isPaymentPosted()) {
            support.checkNotLocked(r.getBranchId(), r.getReceivedAt());
            if (req.receivedAt() != null) {
                support.checkNotLocked(r.getBranchId(), req.receivedAt());
            }
        }
        boolean redated = req.receivedAt() != null && !req.receivedAt().equals(r.getReceivedAt());
        if (req.receivedAt() != null) {
            r.setReceivedAt(req.receivedAt());
        }
        if (req.receiverId() != null) {
            r.setReceiverId(req.receiverId());
            r.setReceiverName(req.receiverName());
        }
        if (redated && r.getStatus() == DocStatus.COMPLETED) {
            stock.redate(r.getId(), r.getReceivedAt()); // thẻ kho đi theo ngày nhập mới
        }
        if (redated && r.isPaymentPosted()) {
            // phiếu chi PC{mã PN} (công nợ NCC và Sổ quỹ) đi theo ngày nhập mới
            debts.receiptRedated(r);
            cashflows.receiptRedated(r);
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
            support.checkNotLocked(r.getBranchId(), r.getReceivedAt());
            Map<UUID, Product> cache = support.newCache();
            for (var line : r.getLines()) {
                Product p = support.product(cache, line.getProductId());
                BigDecimal baseQty = line.getQuantity().multiply(line.getConversionRate());
                stock.apply(p, new Movement(r.getBranchId(), baseQty.negate(), line.getLotNumber(), null,
                        DocType.PURCHASE_CANCEL, r.getId(), r.getCode(), PurchaseReceiptLines.lineCost(r, line), supplierName(r),
                        actor.id(), r.getReceivedAt())); // cùng ngày phiếu nhập → phiếu hủy triệt tiêu đúng ngày đó trên thẻ kho / S2d
            }
        } else if (r.isPaymentPosted()) {
            // phiếu tạm đã lập phiếu chi lúc Lưu tạm → hủy phiếu chi theo (kiểm chi nhánh + khóa sổ theo ngày phiếu chi)
            support.checkBranch(actor, r.getBranchId());
            support.checkNotLocked(r.getBranchId(), r.getReceivedAt());
        }
        if (r.getStatus() == DocStatus.COMPLETED || r.isPaymentPosted()) {
            debts.receiptCancelled(r); // phiếu chi lúc nhập hủy theo; phân bổ khác thành "chưa phân bổ"
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

    /** Phiếu đã lập phiếu chi: chỉ được đổi sang NCC khác, không bỏ / thêm NCC (phiếu chi + công nợ đi theo NCC). */
    static void checkPaidSupplierChange(UUID oldSupplier, UUID newSupplier) {
        if (!Objects.equals(oldSupplier, newSupplier) && (oldSupplier == null || newSupplier == null)) {
            throw BusinessException.badRequest("SUPPLIER_LOCKED_PAID",
                    "Phiếu đã lập phiếu chi trả nhà cung cấp: chỉ được đổi sang nhà cung cấp khác, không bỏ / thêm nhà cung cấp");
        }
    }

    /** Phiếu chi PC{mã} đã lập: đổi NCC / ngày / người nhập của phiếu → chứng từ công nợ và phiếu Sổ quỹ đổi theo. */
    void voucherFollows(PurchaseReceipt r, UUID oldSupplier, Instant oldAt, Supplier supplier) {
        boolean supplierChanged = !Objects.equals(oldSupplier, r.getSupplierId());
        if (supplierChanged) {
            debts.receiptSupplierChanged(r);
        }
        if (!Objects.equals(oldAt, r.getReceivedAt())) {
            debts.receiptRedated(r);
        }
        cashflows.receiptVoucherUpdated(r, supplier);
    }

    private PurchaseReceipt newReceipt(Actor actor) {
        var r = new PurchaseReceipt();
        r.setId(UUID.randomUUID());
        r.setCode("PN%06d".formatted(receipts.nextCodeNumber()));
        r.setCreatedBy(actor.id());
        r.setCreatedByName(actor.name());
        return r;
    }

    /** Phiếu chi trả NCC PC{mã PN} → Sổ quỹ (outbox) + chứng từ công nợ NCC phân bổ vào chính phiếu này. */
    private void postPayment(PurchaseReceipt r) {
        cashflows.receiptPaid(r, support.supplierOrNull(r.getSupplierId()));
        debts.receiptPaid(r);
        r.setPaymentPosted(true);
    }

    private void complete(PurchaseReceipt r) {
        Map<UUID, Product> cache = support.newCache();
        for (var line : r.getLines()) {
            Product p = support.product(cache, line.getProductId());
            BigDecimal baseQty = line.getQuantity().multiply(line.getConversionRate());
            stock.apply(p, new Movement(r.getBranchId(), baseQty, line.getLotNumber(), line.getExpiryDate(),
                    DocType.PURCHASE, r.getId(), r.getCode(), PurchaseReceiptLines.lineCost(r, line), supplierName(r),
                    r.getReceiverId(), r.getReceivedAt()));
        }
        r.setStatus(DocStatus.COMPLETED);
        r.setCompletedAt(Instant.now());
        if (!r.isPaymentPosted()) {
            postPayment(r); // phiếu tạm đã lập phiếu chi lúc Lưu tạm → không lập lần 2
        }
        r.setPaymentPosted(true);
    }

    private String supplierName(PurchaseReceipt r) {
        Supplier s = support.supplierOrNull(r.getSupplierId());
        return s == null ? null : s.getName();
    }
}
