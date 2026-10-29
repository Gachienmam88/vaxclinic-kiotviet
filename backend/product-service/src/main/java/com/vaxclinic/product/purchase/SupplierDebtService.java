package com.vaxclinic.product.purchase;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.product.internal.CashflowOutbox;
import com.vaxclinic.product.internal.CashflowOutbox.SupplierPaymentVoucher;
import com.vaxclinic.product.purchase.PurchaseDtos.Actor;
import com.vaxclinic.product.purchase.SupplierDebtDtos.AdjustmentRequest;
import com.vaxclinic.product.purchase.SupplierDebtDtos.DocUpdateRequest;
import com.vaxclinic.product.purchase.SupplierDebtDtos.PaymentRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * Ghi sổ công nợ NCC. Thanh toán → phiếu chi Sổ quỹ (outbox); chiết khấu thanh toán chỉ giảm nợ; điều chỉnh = nợ mới − nợ cũ.
 * Phân bổ vào phiếu nhập không vượt "Còn cần trả" (khóa dòng phiếu nhập FOR UPDATE); paid_amount = Σ phân bổ thanh toán.
 */
@Service
public class SupplierDebtService {

    private final SupplierDebtRepository repo;
    private final SupplierCommandService suppliers;
    private final SupplierListRepository listQuery;
    private final SupplierDebtAllocator allocator;
    private final PurchaseLineSupport support;
    private final CashflowOutbox cashflows;

    public SupplierDebtService(SupplierDebtRepository repo, SupplierCommandService suppliers, SupplierListRepository listQuery,
                               SupplierDebtAllocator allocator, PurchaseLineSupport support, CashflowOutbox cashflows) {
        this.repo = repo;
        this.suppliers = suppliers;
        this.listQuery = listQuery;
        this.allocator = allocator;
        this.support = support;
        this.cashflows = cashflows;
    }

    @Transactional
    public UUID pay(UUID supplierId, PaymentRequest req, Actor actor) {
        Supplier s = suppliers.find(supplierId);
        Instant at = prepare(req.branchId(), req.occurredAt(), actor);
        BigDecimal amount = PurchaseMath.money(req.amount());
        String method = req.paymentMethod() == null ? "CASH" : req.paymentMethod();
        UUID id = UUID.randomUUID();
        String code = "PCN%06d".formatted(next("supplier_payment_code_seq"));
        String note = PurchaseLineSupport.blankToNull(req.note());
        insert(id, code, s, "PAYMENT", at, amount, req.branchId(), method, req.bankAccountId(), req, actor, note, id);
        allocator.allocate(id, supplierId, amount, req.allocate(), req.allocations(), true);
        cashflows.supplierPayment(new SupplierPaymentVoucher(id, code, method, req.bankAccountId(), amount, at, req.branchId(),
                staffId(req, actor), staffName(req, actor), note == null ? "Thanh toán nhà cung cấp " + s.getName() : note), s);
        return id;
    }

    @Transactional
    public UUID discount(UUID supplierId, PaymentRequest req, Actor actor) {
        Supplier s = suppliers.find(supplierId);
        Instant at = prepare(req.branchId(), req.occurredAt(), actor);
        BigDecimal amount = PurchaseMath.money(req.amount());
        UUID id = UUID.randomUUID();
        String code = "CKN%06d".formatted(next("supplier_discount_code_seq"));
        insert(id, code, s, "DISCOUNT", at, amount, req.branchId(), null, null, req, actor,
                PurchaseLineSupport.blankToNull(req.note()), null);
        allocator.allocate(id, supplierId, amount, req.allocate(), req.allocations(), false);
        return id;
    }

    @Transactional
    public UUID adjust(UUID supplierId, AdjustmentRequest req, Actor actor) {
        Supplier s = suppliers.find(supplierId);
        Instant at = prepare(req.branchId(), req.occurredAt(), actor);
        BigDecimal delta = PurchaseMath.money(req.newDebt()).subtract(listQuery.debt(supplierId));
        if (delta.signum() == 0) {
            throw BusinessException.badRequest("ADJUSTMENT_NO_CHANGE", "Giá trị nợ điều chỉnh bằng nợ hiện tại");
        }
        UUID id = UUID.randomUUID();
        String code = "DCN%06d".formatted(next("supplier_adjust_code_seq"));
        insert(id, code, s, "ADJUSTMENT", at, delta, req.branchId(), null, null, null, actor,
                PurchaseLineSupport.blankToNull(req.note()), null);
        return id;
    }

    /** "Lưu" popup phiếu: đổi thời gian (cả 2 mốc phải ngoài kỳ khóa sổ), nhân viên, ghi chú. */
    @Transactional
    public Map<String, Object> update(UUID docId, DocUpdateRequest req) {
        var d = lockDoc(docId);
        rejectAuto(d);
        UUID branch = (UUID) d.get("branch_id");
        Instant oldAt = ((Timestamp) d.get("occurred_at")).toInstant();
        Instant at = req.occurredAt() == null ? oldAt : req.occurredAt();
        support.checkNotLocked(branch, oldAt);
        support.checkNotLocked(branch, at);
        UUID staffId = req.staffId() == null ? (UUID) d.get("staff_id") : req.staffId();
        String staffName = req.staffId() == null ? (String) d.get("staff_name") : req.staffName();
        String note = PurchaseLineSupport.blankToNull(req.note());
        repo.updateDoc(docId, at, staffId, staffName, note);
        if ("PAYMENT".equals(d.get("kind")) && d.get("cash_source_id") != null) {
            cashflows.supplierPaymentUpdated((UUID) d.get("cash_source_id"), at, staffId, staffName, note);
        }
        return d;
    }

    /** Hủy phiếu: hoàn lại phân bổ cho phiếu nhập; phiếu chi → hủy phiếu chi Sổ quỹ. */
    @Transactional
    public Map<String, Object> cancel(UUID docId) {
        var d = lockDoc(docId);
        rejectAuto(d);
        support.checkNotLocked((UUID) d.get("branch_id"), ((Timestamp) d.get("occurred_at")).toInstant());
        repo.cancelDoc(docId);
        if ("PAYMENT".equals(d.get("kind"))) {
            repo.revertPaidAmounts(docId);
            if (d.get("cash_source_id") != null) {
                cashflows.supplierPaymentCancelled((UUID) d.get("cash_source_id"));
            }
        }
        return d;
    }

    /** Phiếu nhập hoàn thành có trả tiền NCC → phiếu chi PC{mã PN} phân bổ đúng phiếu đó (paid_amount đã gán sẵn). */
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.MANDATORY)
    public void receiptPaid(PurchaseReceipt r) {
        if (r.getSupplierId() == null || r.getPaidAmount().signum() <= 0) {
            return;
        }
        UUID id = UUID.randomUUID();
        UUID staff = r.getReceiverId() == null ? r.getCreatedBy() : r.getReceiverId();
        String staffName = r.getReceiverName() == null ? r.getCreatedByName() : r.getReceiverName();
        repo.insertReceiptPayment(id, r, staff, staffName);
        repo.insertAllocation(id, r.getId(), r.getPaidAmount());
    }

    /** Trả hàng nhập có tiền NCC hoàn → chứng từ REFUND PT{mã THN} (tăng nợ +refund; phiếu trả ghi −total trong sổ). */
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.MANDATORY)
    public void returnRefunded(PurchaseReturn r) {
        if (r.getSupplierId() == null) {
            return; // trả nhanh không NCC: chỉ có phiếu thu Sổ quỹ, không có sổ công nợ
        }
        repo.insertReturnRefund(UUID.randomUUID(), r);
    }

    /** Hủy trả hàng nhập → chứng từ REFUND của phiếu bị hủy theo. */
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.MANDATORY)
    public void returnCancelled(PurchaseReturn r) {
        repo.cancelReturnDocs(r.getId());
    }

    /** Đổi ngày nhập của phiếu đã hoàn thành → phiếu chi PC{mã PN} (tạo lúc nhập) đổi ngày theo. */
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.MANDATORY)
    public void receiptRedated(PurchaseReceipt r) {
        repo.redateReceiptPayment(r.getId(), r.getReceivedAt());
    }

    /**
     * Hủy phiếu nhập: phiếu chi lúc nhập hàng bị hủy theo; tiền của phiếu chi khác đã phân bổ vào phiếu này trở thành
     * "chưa phân bổ" (vẫn giảm nợ NCC). Cập nhật paid_amount qua entity vì phiếu nhập đang được JPA quản lý.
     */
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.MANDATORY)
    public void receiptCancelled(PurchaseReceipt r) {
        repo.cancelActiveDocsOfReceipt(r.getId());
        BigDecimal released = repo.activePaymentAllocated(r.getId());
        repo.deleteActiveAllocations(r.getId());
        r.setPaidAmount(r.getPaidAmount().subtract(released));
    }

    private Instant prepare(UUID branchId, Instant occurredAt, Actor actor) {
        support.checkBranch(actor, branchId);
        Instant at = occurredAt == null ? Instant.now() : occurredAt;
        support.checkNotLocked(branchId, at);
        return at;
    }

    /** Phiếu thu NCC hoàn tiền (REFUND) đi theo phiếu trả hàng nhập: sửa / hủy ở phiếu trả, không sửa riêng. */
    private static void rejectAuto(Map<String, Object> d) {
        if ("REFUND".equals(d.get("kind"))) {
            throw BusinessException.badRequest("SUPPLIER_DOC_AUTO",
                    "Phiếu thu này tạo từ trả hàng nhập, hãy hủy phiếu trả hàng nhập để hủy phiếu thu");
        }
    }

    private Map<String, Object> lockDoc(UUID docId) {
        var rows = repo.lockDoc(docId);
        if (rows.isEmpty()) {
            throw BusinessException.notFound("SUPPLIER_DOC_NOT_FOUND", "Không tìm thấy phiếu");
        }
        if (!"ACTIVE".equals(rows.get(0).get("status"))) {
            throw BusinessException.badRequest("SUPPLIER_DOC_CANCELLED", "Phiếu đã bị hủy");
        }
        return rows.get(0);
    }

    private void insert(UUID id, String code, Supplier s, String kind, Instant at, BigDecimal amount, UUID branchId,
                        String method, UUID bankAccountId, PaymentRequest req, Actor actor, String note, UUID cashSourceId) {
        repo.insertDoc(id, code, s.getId(), kind, at, amount, branchId, method, bankAccountId, staffId(req, actor),
                staffName(req, actor), actor.id(), actor.name(), note, cashSourceId);
    }

    private static UUID staffId(PaymentRequest req, Actor actor) {
        return req == null || req.staffId() == null ? actor.id() : req.staffId();
    }

    private static String staffName(PaymentRequest req, Actor actor) {
        return req == null || req.staffId() == null ? actor.name() : req.staffName();
    }

    private long next(String seq) {
        return repo.next(seq);
    }
}
