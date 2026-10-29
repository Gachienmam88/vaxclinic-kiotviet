package com.vaxclinic.sales.delivery;

import com.vaxclinic.sales.delivery.ShipmentDtos.Cashflow;
import com.vaxclinic.sales.delivery.ShipmentDtos.CashflowRow;
import com.vaxclinic.sales.delivery.ShipmentDtos.Dashboard;
import com.vaxclinic.sales.delivery.ShipmentDtos.StatusStat;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.UUID;

/**
 * Quản lý giao hàng: Thống kê (vận đơn tạo trong kỳ theo trạng thái, đơn cần xử lý) và Dòng tiền (sổ công nợ đối tác:
 * thu hộ đối tác đã thu, phí giao hàng, đã đối soát / thanh toán trong kỳ, còn lại hiện tại).
 */
@Repository
public class ShipmentDashboardRepository {

    /** partnerId / connection (MANUAL = tự giao hàng) có thể null. */
    public record Scope(List<UUID> branches, Instant from, Instant to, UUID partnerId, String connection) {
    }

    private final NamedParameterJdbcTemplate jdbc;

    public ShipmentDashboardRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Dashboard dashboard(Scope s) {
        var p = params(s);
        String w = " from shipments s join delivery_partners p on p.id = s.partner_id where s.branch_id in (:branches)"
                + " and s.created_at >= :from and s.created_at < :to" + partnerFilter(s);
        var stats = new HashMap<String, StatusStat>();
        jdbc.query("select s.status, count(*) n, coalesce(sum(s.cod_amount), 0) cod, coalesce(sum(s.shipping_fee), 0) fee" + w
                + " group by s.status", p, rs -> {
            stats.put(rs.getString("status"), new StatusStat(rs.getString("status"), rs.getLong("n"), rs.getBigDecimal("cod"),
                    rs.getBigDecimal("fee")));
        });
        var rows = new ArrayList<StatusStat>();
        ShipmentStatus.LABELS.keySet().forEach(k -> rows.add(stats.getOrDefault(k, new StatusStat(k, 0, BigDecimal.ZERO, BigDecimal.ZERO))));
        long total = 0;
        BigDecimal cod = BigDecimal.ZERO;
        BigDecimal fee = BigDecimal.ZERO;
        for (StatusStat r : rows) {
            if (ShipmentStatus.CANCELLED.equals(r.status())) continue; // tổng hợp không tính đơn đã hủy
            total += r.count();
            cod = cod.add(r.cod());
            fee = fee.add(r.fee());
        }
        Long overdue = jdbc.queryForObject("select count(*)" + w + " and s.expected_delivery_at < now()"
                + " and s.status in ('PENDING','PICKING','PICKED','WAIT_REPICK','DELIVERING','WAIT_REDELIVER')", p, Long.class);
        return new Dashboard(count(stats, ShipmentStatus.WAIT_REDELIVER), count(stats, ShipmentStatus.WAIT_RETURN),
                overdue == null ? 0 : overdue, total, cod, fee, rows);
    }

    public Cashflow cashflow(Scope s) {
        var p = params(s);
        var rows = jdbc.query("""
                select p.id, p.code, p.name, p.debt,
                  coalesce(sum(case when l.doc_type = 'COD' then l.amount end), 0) cod,
                  coalesce(-sum(case when l.doc_type = 'FEE' then l.amount end), 0) fee,
                  coalesce(-sum(case when l.doc_type in ('SETTLEMENT','SETTLEMENT_CANCEL') and l.amount < 0 then l.amount end), 0) s_in,
                  coalesce(sum(case when l.doc_type in ('SETTLEMENT','SETTLEMENT_CANCEL') and l.amount > 0 then l.amount end), 0) s_out
                from delivery_partners p left join delivery_partner_ledger l on l.partner_id = p.id and l.branch_id in (:branches)
                  and l.occurred_at >= :from and l.occurred_at < :to
                where 1=1""" + partnerFilter(s) + " group by p.id, p.code, p.name, p.debt order by p.code", p,
                (rs, n) -> new CashflowRow(rs.getObject("id", UUID.class), rs.getString("code"), rs.getString("name"),
                        rs.getBigDecimal("cod"), rs.getBigDecimal("fee"), rs.getBigDecimal("s_in"), rs.getBigDecimal("s_out"),
                        rs.getBigDecimal("debt")));
        return new Cashflow(rows, sum(rows, CashflowRow::codCollected), sum(rows, CashflowRow::feeCharged),
                sum(rows, CashflowRow::settledIn), sum(rows, CashflowRow::settledOut), sum(rows, CashflowRow::balance));
    }

    private static MapSqlParameterSource params(Scope s) {
        return new MapSqlParameterSource("branches", s.branches().isEmpty() ? List.of(new UUID(0, 0)) : s.branches())
                .addValue("from", Timestamp.from(s.from())).addValue("to", Timestamp.from(s.to()))
                .addValue("partner", s.partnerId()).addValue("conn", s.connection());
    }

    private static String partnerFilter(Scope s) {
        return (s.partnerId() == null ? "" : " and p.id = :partner")
                + (s.connection() == null || s.connection().isBlank() ? "" : " and p.partner_type = :conn");
    }

    private static long count(java.util.Map<String, StatusStat> m, String status) {
        StatusStat r = m.get(status);
        return r == null ? 0 : r.count();
    }

    private static BigDecimal sum(List<CashflowRow> rows, java.util.function.Function<CashflowRow, BigDecimal> f) {
        return rows.stream().map(f).reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
