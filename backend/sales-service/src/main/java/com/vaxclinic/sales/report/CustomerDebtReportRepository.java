package com.vaxclinic.sales.report;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Báo cáo công nợ khách hàng từ sổ công nợ: nợ đầu kỳ, ghi nợ (phát sinh tăng), ghi có (phát sinh giảm), nợ cuối kỳ.
 * Toàn cửa hàng (sổ công nợ không tách chi nhánh). Chỉ truy cập DB.
 */
@Repository
public class CustomerDebtReportRepository {

    public record DebtRow(UUID customerId, String code, String name, String phone, BigDecimal opening, BigDecimal debit,
                          BigDecimal credit, BigDecimal closing) {
    }

    private final NamedParameterJdbcTemplate jdbc;

    public CustomerDebtReportRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Khách có nợ đầu kỳ ≠ 0 hoặc có phát sinh trong [from, to); customerId null = mọi khách. */
    public List<DebtRow> debt(Instant from, Instant to, UUID customerId) {
        var p = new MapSqlParameterSource("from", Timestamp.from(from)).addValue("to", Timestamp.from(to)).addValue("customerId", customerId);
        return jdbc.query("""
                select c.id, c.code, c.name, c.phone,
                  coalesce(sum(d.amount) filter (where d.occurred_at < :from), 0) opening,
                  coalesce(sum(d.amount) filter (where d.occurred_at >= :from and d.amount > 0), 0) debit,
                  coalesce(-sum(d.amount) filter (where d.occurred_at >= :from and d.amount < 0), 0) credit
                from customer_debt_ledger d join customers c on c.id = d.customer_id
                where d.occurred_at < :to%s
                group by c.id, c.code, c.name, c.phone
                having coalesce(sum(d.amount) filter (where d.occurred_at < :from), 0) <> 0
                  or count(*) filter (where d.occurred_at >= :from) > 0
                order by c.code""".formatted(customerId == null ? "" : " and c.id = :customerId"), p, (rs, n) -> {
            BigDecimal o = rs.getBigDecimal("opening"), dr = rs.getBigDecimal("debit"), cr = rs.getBigDecimal("credit");
            return new DebtRow(rs.getObject("id", UUID.class), rs.getString("code"), rs.getString("name"), rs.getString("phone"),
                    o, dr, cr, o.add(dr).subtract(cr));
        });
    }
}
