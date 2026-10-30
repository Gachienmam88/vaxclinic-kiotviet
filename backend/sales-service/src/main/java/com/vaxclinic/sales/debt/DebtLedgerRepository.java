package com.vaxclinic.sales.debt;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.UUID;

/** Ghi dòng sổ công nợ khách (customer_debt_ledger) + dãy số mã chiết khấu / điều chỉnh nợ. Thứ tự ghi do {@link DebtLedger}. */
@Repository
public class DebtLedgerRepository {

    private final JdbcTemplate jdbc;

    public DebtLedgerRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** branchId null → chi nhánh mặc định (seed CN001), như dữ liệu cũ không suy ra được chi nhánh (migration V23). */
    public void insert(UUID customerId, UUID branchId, String docType, UUID docId, String docCode, BigDecimal amount,
                       BigDecimal balanceAfter, String note, Instant at) {
        jdbc.update("""
                insert into customer_debt_ledger(id, customer_id, branch_id, doc_type, doc_id, doc_code, amount, balance_after, note, occurred_at)
                values (?,?,coalesce(?, '00000000-0000-0000-0000-000000000001'::uuid),?,?,?,?,?,?,?)""", UUID.randomUUID(), customerId,
                branchId, docType, docId, docCode, amount, balanceAfter, note, Timestamp.from(at));
    }

    /** Số tiếp theo của mã chiết khấu thanh toán CKTTxxxxxx. */
    public Long nextDiscountNumber() {
        return jdbc.queryForObject("select nextval('debt_discount_seq')", Long.class);
    }

    /** Số tiếp theo của mã điều chỉnh nợ DCxxxxxx. */
    public Long nextAdjustNumber() {
        return jdbc.queryForObject("select nextval('debt_adjust_seq')", Long.class);
    }
}
