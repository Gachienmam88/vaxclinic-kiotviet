package com.vaxclinic.product.purchase.service;

import com.vaxclinic.product.purchase.dto.SupplierDebtDtos;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.product.purchase.dto.SupplierDebtDtos.AllocationInput;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.UUID;

/**
 * Phân bổ thanh toán / chiết khấu vào phiếu nhập (quy tắc KiotViet):
 * - allocations do người dùng nhập từng dòng: mỗi dòng ≤ "Còn cần trả" của phiếu, tổng ≤ số tiền phiếu;
 * - allocations = null: tự phân bổ phiếu cũ trước tới hết tiền; phần dư = "chưa phân bổ" (trả trước, nợ NCC có thể âm).
 */
@Component
public class SupplierDebtAllocator {

    private final JdbcTemplate jdbc;
    private final SupplierDebtQuery query;

    public SupplierDebtAllocator(JdbcTemplate jdbc, SupplierDebtQuery query) {
        this.jdbc = jdbc;
        this.query = query;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void allocate(UUID docId, UUID supplierId, BigDecimal amount, boolean allocate, List<AllocationInput> inputs,
                         boolean payment) {
        if (!allocate) {
            return;
        }
        List<AllocationInput> list = inputs == null ? auto(supplierId, amount) : inputs;
        BigDecimal total = BigDecimal.ZERO;
        var seen = new HashSet<UUID>();
        for (var a : list) {
            BigDecimal v = PurchaseMath.money(a.amount());
            if (v.signum() <= 0) {
                continue;
            }
            if (!seen.add(a.receiptId())) {
                throw BusinessException.badRequest("ALLOCATION_DUPLICATE", "Phiếu nhập bị phân bổ trùng");
            }
            total = total.add(v);
            if (total.compareTo(amount) > 0) {
                throw BusinessException.badRequest("ALLOCATION_EXCEEDS", "Tổng phân bổ lớn hơn số tiền phiếu");
            }
            var rows = jdbc.queryForList("select code, supplier_id, status, total from purchase_receipts where id = ? for update",
                    a.receiptId());
            if (rows.isEmpty() || !"COMPLETED".equals(rows.get(0).get("status"))
                    || !supplierId.equals(rows.get(0).get("supplier_id"))) {
                throw BusinessException.badRequest("ALLOCATION_RECEIPT_INVALID", "Phiếu nhập không thuộc nhà cung cấp hoặc chưa hoàn thành");
            }
            var r = rows.get(0);
            BigDecimal remaining = ((BigDecimal) r.get("total")).subtract(settled(a.receiptId()));
            if (v.compareTo(remaining) > 0) {
                throw BusinessException.badRequest("ALLOCATION_EXCEEDS_RECEIPT", "Phiếu " + r.get("code") + " chỉ còn cần trả "
                        + String.format("%,.0f", remaining));
            }
            jdbc.update("insert into supplier_debt_allocations(doc_id, receipt_id, amount) values (?, ?, ?)", docId,
                    a.receiptId(), v);
            if (payment) {
                jdbc.update("update purchase_receipts set paid_amount = paid_amount + ?, updated_at = now() where id = ?", v,
                        a.receiptId());
            }
        }
    }

    /** Cũ trước: lấy min(còn lại, còn cần trả) cho từng phiếu. */
    private List<AllocationInput> auto(UUID supplierId, BigDecimal amount) {
        List<AllocationInput> out = new ArrayList<>();
        BigDecimal left = amount;
        for (var r : query.unpaid(supplierId)) {
            if (left.signum() <= 0) {
                break;
            }
            BigDecimal take = left.min(r.remaining());
            out.add(new AllocationInput(r.id(), take));
            left = left.subtract(take);
        }
        return out;
    }

    private BigDecimal settled(UUID receiptId) {
        return jdbc.queryForObject("""
                select coalesce(sum(a.amount), 0) from supplier_debt_allocations a join supplier_debt_docs d on d.id = a.doc_id
                where a.receipt_id = ? and d.status = 'ACTIVE'""", BigDecimal.class, receiptId);
    }
}
