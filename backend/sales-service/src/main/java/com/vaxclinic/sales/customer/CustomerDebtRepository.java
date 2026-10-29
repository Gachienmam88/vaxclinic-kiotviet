package com.vaxclinic.sales.customer;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Đọc sổ công nợ của 1 khách (customer_debt_ledger) cho tab "Nợ cần thu từ khách". Ghi sổ ở DebtLedger. */
@Repository
public class CustomerDebtRepository {

    public record DebtLine(UUID id, String docType, String docCode, UUID docId, Instant occurredAt, BigDecimal amount,
                           BigDecimal balanceAfter, String note) {
    }

    private final NamedParameterJdbcTemplate jdbc;

    public CustomerDebtRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Mới nhất trước, tối đa 200 dòng. */
    public List<DebtLine> latest(UUID customerId) {
        return jdbc.query("select * from customer_debt_ledger where customer_id = :id order by occurred_at desc, balance_after limit 200",
                new MapSqlParameterSource("id", customerId), (rs, n) -> new DebtLine(rs.getObject("id", UUID.class),
                        rs.getString("doc_type"), rs.getString("doc_code"), rs.getObject("doc_id", UUID.class),
                        rs.getTimestamp("occurred_at").toInstant(), rs.getBigDecimal("amount"),
                        rs.getBigDecimal("balance_after"), rs.getString("note")));
    }
}
