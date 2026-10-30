package com.vaxclinic.sales.debt;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.sales.customer.Customer;
import com.vaxclinic.sales.customer.CustomerRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * Sổ công nợ khách hàng — nơi DUY NHẤT thay đổi customers.debt.
 * amount > 0: tăng nợ (bán hàng chưa thu đủ). amount < 0: giảm nợ (thanh toán, chiết khấu, hủy hóa đơn).
 * Khóa dòng khách hàng trước khi ghi để "dư nợ sau" luôn đúng thứ tự.
 */
@Component
public class DebtLedger {

    /** RETURN: khách trả hàng (giảm nợ); REFUND: tiền đã chi trả khách (tăng lại phần đã giảm). */
    public enum DocType { SALE, SALE_CANCEL, PAYMENT, PAYMENT_CANCEL, ADJUST, DISCOUNT, RETURN, RETURN_CANCEL, REFUND, REFUND_CANCEL }

    private final DebtLedgerRepository entries;
    private final CustomerRepository customers;

    public DebtLedger(DebtLedgerRepository entries, CustomerRepository customers) {
        this.entries = entries;
        this.customers = customers;
    }

    /**
     * branchId: chi nhánh của chứng từ phát sinh (hóa đơn, phiếu trả, phiếu thu/chi, đơn đặt, chiết khấu tại quầy) — để báo cáo
     * lọc theo chi nhánh; null (VD điều chỉnh nợ không chọn chi nhánh) → chi nhánh tạo khách, không có thì chi nhánh mặc định.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public Customer post(UUID customerId, UUID branchId, DocType type, UUID docId, String docCode, BigDecimal amount, String note,
                         Instant at) {
        Customer c = customers.findForUpdate(customerId)
                .orElseThrow(() -> BusinessException.notFound("CUSTOMER_NOT_FOUND", "Không tìm thấy khách hàng"));
        if (amount.signum() == 0) {
            return c;
        }
        BigDecimal after = c.getDebt().add(amount);
        c.setDebt(after);
        entries.insert(customerId, branchId != null ? branchId : c.getBranchId(), type.name(), docId, docCode, amount, after, note, at);
        return c;
    }
}
