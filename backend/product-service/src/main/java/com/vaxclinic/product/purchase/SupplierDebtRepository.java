package com.vaxclinic.product.purchase;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Ghi sổ công nợ NCC: supplier_debt_docs, supplier_debt_allocations, paid_amount của phiếu nhập; khóa FOR UPDATE.
 * Chỉ truy cập DB, chạy trong transaction của service gọi. Đọc sổ / báo cáo ở {@link SupplierDebtQueryRepository}.
 */
@Repository
public class SupplierDebtRepository {

    private final JdbcTemplate jdbc;

    public SupplierDebtRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public long next(String seq) {
        return jdbc.queryForObject("select nextval('" + seq + "')", Long.class);
    }

    public void insertDoc(UUID id, String code, UUID supplierId, String kind, Instant at, BigDecimal amount, UUID branchId,
                          String method, UUID bankAccountId, UUID staffId, String staffName, UUID createdBy,
                          String createdByName, String note, UUID cashSourceId) {
        jdbc.update("""
                insert into supplier_debt_docs(id, code, supplier_id, kind, occurred_at, amount, branch_id, payment_method,
                  bank_account_id, staff_id, staff_name, created_by, created_by_name, note, cash_source_id)
                values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""", id, code, supplierId, kind, Timestamp.from(at), amount,
                branchId, method, bankAccountId, staffId, staffName, createdBy, createdByName, note, cashSourceId);
    }

    /** Phiếu chi PC{mã PN} tạo lúc hoàn thành phiếu nhập (receipt_id = cash_source_id = id phiếu nhập). */
    public void insertReceiptPayment(UUID id, PurchaseReceipt r, UUID staff, String staffName) {
        jdbc.update("""
                insert into supplier_debt_docs(id, code, supplier_id, kind, occurred_at, amount, branch_id, payment_method,
                  staff_id, staff_name, created_by, created_by_name, note, receipt_id, cash_source_id)
                values (?, ?, ?, 'PAYMENT', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""", id, "PC" + r.getCode(), r.getSupplierId(),
                Timestamp.from(r.getReceivedAt()), r.getPaidAmount(), r.getBranchId(),
                r.getPaymentMethod() == null ? "CASH" : r.getPaymentMethod(), staff, staffName, r.getCreatedBy(),
                r.getCreatedByName(), "Thanh toán phiếu nhập " + r.getCode(), r.getId(), r.getId());
    }

    /** select * ... for update; rỗng nếu không có. */
    public List<Map<String, Object>> lockDoc(UUID docId) {
        return jdbc.queryForList("select * from supplier_debt_docs where id = ? for update", docId);
    }

    public void updateDoc(UUID docId, Instant at, UUID staffId, String staffName, String note) {
        jdbc.update("update supplier_debt_docs set occurred_at = ?, staff_id = ?, staff_name = ?, note = ? where id = ?",
                Timestamp.from(at), staffId, staffName, note, docId);
    }

    public void cancelDoc(UUID docId) {
        jdbc.update("update supplier_debt_docs set status = 'CANCELLED', cancelled_at = now() where id = ?", docId);
    }

    /** Trừ lại paid_amount của các phiếu nhập đã được phiếu chi docId phân bổ. */
    public void revertPaidAmounts(UUID docId) {
        jdbc.update("""
                update purchase_receipts r set paid_amount = r.paid_amount - a.amount, updated_at = now()
                from supplier_debt_allocations a where a.doc_id = ? and a.receipt_id = r.id""", docId);
    }

    public void cancelActiveDocsOfReceipt(UUID receiptId) {
        jdbc.update("update supplier_debt_docs set status = 'CANCELLED', cancelled_at = now() where receipt_id = ? and status = 'ACTIVE'",
                receiptId);
    }

    /** Σ phân bổ từ phiếu chi (PAYMENT) còn hiệu lực vào phiếu nhập. */
    public BigDecimal activePaymentAllocated(UUID receiptId) {
        return jdbc.queryForObject("""
                select coalesce(sum(a.amount), 0) from supplier_debt_allocations a join supplier_debt_docs d on d.id = a.doc_id
                where a.receipt_id = ? and d.status = 'ACTIVE' and d.kind = 'PAYMENT'""", BigDecimal.class, receiptId);
    }

    public void deleteActiveAllocations(UUID receiptId) {
        jdbc.update("""
                delete from supplier_debt_allocations a using supplier_debt_docs d
                where d.id = a.doc_id and a.receipt_id = ? and d.status = 'ACTIVE'""", receiptId);
    }

    /** code, supplier_id, status, total của phiếu nhập, khóa FOR UPDATE; rỗng nếu không có. */
    public List<Map<String, Object>> lockReceipt(UUID receiptId) {
        return jdbc.queryForList("select code, supplier_id, status, total from purchase_receipts where id = ? for update",
                receiptId);
    }

    /** Σ phân bổ (thanh toán + chiết khấu) còn hiệu lực vào phiếu nhập. */
    public BigDecimal settled(UUID receiptId) {
        return jdbc.queryForObject("""
                select coalesce(sum(a.amount), 0) from supplier_debt_allocations a join supplier_debt_docs d on d.id = a.doc_id
                where a.receipt_id = ? and d.status = 'ACTIVE'""", BigDecimal.class, receiptId);
    }

    public void insertAllocation(UUID docId, UUID receiptId, BigDecimal amount) {
        jdbc.update("insert into supplier_debt_allocations(doc_id, receipt_id, amount) values (?, ?, ?)", docId, receiptId,
                amount);
    }

    public void addPaidAmount(UUID receiptId, BigDecimal amount) {
        jdbc.update("update purchase_receipts set paid_amount = paid_amount + ?, updated_at = now() where id = ?", amount,
                receiptId);
    }

    /** Số chứng từ của NCC (phiếu nhập, trả hàng nhập, phiếu công nợ — mọi trạng thái). */
    public Long transactionCount(UUID supplierId) {
        return jdbc.queryForObject("""
                select (select count(*) from purchase_receipts where supplier_id = ?)
                     + (select count(*) from purchase_returns where supplier_id = ?)
                     + (select count(*) from supplier_debt_docs where supplier_id = ?)""", Long.class, supplierId, supplierId,
                supplierId);
    }
}
