package com.vaxclinic.sales.report;

import com.vaxclinic.common.error.BusinessException;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Báo cáo công nợ khách hàng (Báo cáo khách hàng – Công nợ) từ sổ công nợ: nợ đầu kỳ, ghi nợ (phát sinh tăng: bán hàng,
 * điều chỉnh tăng, hoàn cọc), ghi có (phát sinh giảm: thanh toán, chiết khấu, trả hàng), nợ cuối kỳ. Sổ công nợ theo
 * khách (không tách chi nhánh) nên báo cáo này tính trên toàn cửa hàng.
 */
@Component
public class CustomerDebtReportQuery {

    public record DebtRow(UUID customerId, String code, String name, String phone, BigDecimal opening, BigDecimal debit,
                          BigDecimal credit, BigDecimal closing) {
    }

    private final NamedParameterJdbcTemplate jdbc;

    public CustomerDebtReportQuery(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<DebtRow> debt(Instant from, Instant to, UUID customerId) {
        if (!from.isBefore(to)) {
            throw BusinessException.badRequest("REPORT_RANGE_INVALID", "Khoảng thời gian báo cáo không hợp lệ");
        }
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
