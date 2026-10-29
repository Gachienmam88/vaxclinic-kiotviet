package com.vaxclinic.product.purchase;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.product.purchase.SupplierDebtDtos.AllocationInput;
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

    private final SupplierDebtRepository repo;
    private final SupplierDebtQueryRepository query;

    public SupplierDebtAllocator(SupplierDebtRepository repo, SupplierDebtQueryRepository query) {
        this.repo = repo;
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
            var rows = repo.lockReceipt(a.receiptId());
            if (rows.isEmpty() || !"COMPLETED".equals(rows.get(0).get("status"))
                    || !supplierId.equals(rows.get(0).get("supplier_id"))) {
                throw BusinessException.badRequest("ALLOCATION_RECEIPT_INVALID", "Phiếu nhập không thuộc nhà cung cấp hoặc chưa hoàn thành");
            }
            var r = rows.get(0);
            BigDecimal remaining = ((BigDecimal) r.get("total")).subtract(repo.settled(a.receiptId()));
            if (v.compareTo(remaining) > 0) {
                throw BusinessException.badRequest("ALLOCATION_EXCEEDS_RECEIPT", "Phiếu " + r.get("code") + " chỉ còn cần trả "
                        + String.format("%,.0f", remaining));
            }
            repo.insertAllocation(docId, a.receiptId(), v);
            if (payment) {
                repo.addPaidAmount(a.receiptId(), v);
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
}
