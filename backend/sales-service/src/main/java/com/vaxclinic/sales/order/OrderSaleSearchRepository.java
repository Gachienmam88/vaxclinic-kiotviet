package com.vaxclinic.sales.order;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Tìm đơn đặt hàng còn xử lý được (DRAFT / CONFIRMED) cho màn bán hàng, mới nhất trước. Chỉ truy cập DB. */
@Repository
public class OrderSaleSearchRepository {

    public record SaleOrderItem(UUID id, String code, Instant orderedAt, String customerName, BigDecimal total, String status,
                                String note) {
    }

    /** Bộ lọc (giá trị trống = bỏ qua). */
    public record Filter(String code, String customer, String note, String productCode, String productName, Instant from,
                         Instant to, UUID branchId) {
    }

    public record Page(List<SaleOrderItem> items, long total) {
    }

    private final NamedParameterJdbcTemplate jdbc;

    public OrderSaleSearchRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Trang [offset, offset + limit). */
    public Page search(Filter f, int limit, long offset) {
        var p = new MapSqlParameterSource();
        var w = new StringBuilder(" from customer_orders o join customers c on c.id = o.customer_id"
                + " where o.status in ('DRAFT', 'CONFIRMED')");
        if (like(p, "code", f.code())) w.append(" and o.code ilike :code");
        if (like(p, "customer", f.customer())) {
            w.append(" and (o.customer_name ilike :customer or c.code ilike :customer or c.phone ilike :customer)");
        }
        if (like(p, "note", f.note())) w.append(" and o.note ilike :note");
        if (like(p, "productCode", f.productCode())) {
            w.append(" and exists (select 1 from customer_order_lines l where l.order_id = o.id and l.product_code ilike :productCode)");
        }
        if (like(p, "productName", f.productName())) {
            w.append(" and exists (select 1 from customer_order_lines l where l.order_id = o.id and l.product_name ilike :productName)");
        }
        if (f.from() != null) { w.append(" and o.ordered_at >= :from"); p.addValue("from", Timestamp.from(f.from())); }
        if (f.to() != null) { w.append(" and o.ordered_at < :to"); p.addValue("to", Timestamp.from(f.to())); }
        if (f.branchId() != null) { w.append(" and o.branch_id = :branchId"); p.addValue("branchId", f.branchId()); }
        Long total = jdbc.queryForObject("select count(*)" + w, p, Long.class);
        p.addValue("limit", limit).addValue("offset", offset);
        var items = jdbc.query("select o.id, o.code, o.ordered_at, o.customer_name, o.total, o.status, o.note" + w
                + " order by o.ordered_at desc, o.code desc limit :limit offset :offset", p,
                (rs, n) -> new SaleOrderItem(rs.getObject("id", UUID.class), rs.getString("code"),
                        rs.getTimestamp("ordered_at").toInstant(), rs.getString("customer_name"), rs.getBigDecimal("total"),
                        rs.getString("status"), rs.getString("note")));
        return new Page(items, total == null ? 0L : total);
    }

    private static boolean like(MapSqlParameterSource p, String name, String v) {
        if (v == null || v.isBlank()) {
            return false;
        }
        p.addValue(name, "%" + v.trim() + "%");
        return true;
    }
}
