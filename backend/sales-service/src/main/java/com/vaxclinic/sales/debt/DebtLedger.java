package com.vaxclinic.sales.debt;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.sales.customer.Customer;
import com.vaxclinic.sales.customer.CustomerRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.UUID;

/**
 * Sổ công nợ khách hàng — nơi DUY NHẤT thay đổi customers.debt.
 * amount > 0: tăng nợ (bán hàng chưa thu đủ). amount < 0: giảm nợ (thanh toán, chiết khấu, hủy hóa đơn).
 * Khóa dòng khách hàng trước khi ghi để "dư nợ sau" luôn đúng thứ tự.
 */
@Component
public class DebtLedger {

    public enum DocType { SALE, SALE_CANCEL, PAYMENT, PAYMENT_CANCEL, ADJUST, DISCOUNT }

    private final JdbcTemplate jdbc;
    private final CustomerRepository customers;

    public DebtLedger(JdbcTemplate jdbc, CustomerRepository customers) {
        this.jdbc = jdbc;
        this.customers = customers;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public Customer post(UUID customerId, DocType type, UUID docId, String docCode, BigDecimal amount, String note,
                         Instant at) {
        Customer c = customers.findForUpdate(customerId)
                .orElseThrow(() -> BusinessException.notFound("CUSTOMER_NOT_FOUND", "Không tìm thấy khách hàng"));
        if (amount.signum() == 0) {
            return c;
        }
        BigDecimal after = c.getDebt().add(amount);
        c.setDebt(after);
        jdbc.update("""
                insert into customer_debt_ledger(id, customer_id, doc_type, doc_id, doc_code, amount, balance_after, note, occurred_at)
                values (?,?,?,?,?,?,?,?,?)""", UUID.randomUUID(), customerId, type.name(), docId, docCode, amount, after,
                note, Timestamp.from(at));
        return c;
    }
}
