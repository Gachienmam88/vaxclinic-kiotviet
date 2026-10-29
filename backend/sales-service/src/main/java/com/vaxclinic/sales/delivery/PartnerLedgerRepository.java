package com.vaxclinic.sales.delivery;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.UUID;

/** Dư nợ delivery_partners.debt + dòng sổ delivery_partner_ledger. Thứ tự khóa / ghi do {@link PartnerLedger}. */
@Repository
public class PartnerLedgerRepository {

    private final JdbcTemplate jdbc;

    public PartnerLedgerRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Khóa dòng đối tác, trả về dư nợ hiện tại (null = không có đối tác). */
    public BigDecimal lockDebt(UUID partnerId) {
        return jdbc.query("select debt from delivery_partners where id = ? for update",
                rs -> rs.next() ? rs.getBigDecimal(1) : null, partnerId);
    }

    public void updateDebt(UUID partnerId, BigDecimal debt) {
        jdbc.update("update delivery_partners set debt = ? where id = ?", debt, partnerId);
    }

    public void insert(UUID partnerId, UUID branchId, String docType, UUID docId, String docCode, BigDecimal amount,
                       BigDecimal balanceAfter, String note, Instant at) {
        jdbc.update("""
                insert into delivery_partner_ledger(id, partner_id, branch_id, doc_type, doc_id, doc_code, amount, balance_after,
                    note, occurred_at) values (?,?,?,?,?,?,?,?,?,?)""", UUID.randomUUID(), partnerId, branchId, docType, docId,
                docCode, amount, balanceAfter, note, Timestamp.from(at));
    }
}
