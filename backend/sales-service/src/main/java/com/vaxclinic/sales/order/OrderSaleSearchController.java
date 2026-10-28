package com.vaxclinic.sales.order;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * "Xử lý đặt hàng" ở màn bán hàng: đơn còn xử lý được (Phiếu tạm DRAFT / Đã xác nhận CONFIRMED — xem CustomerOrder.isOpen),
 * lọc theo mã / khách / ghi chú / hàng / thời gian đặt / chi nhánh, mới nhất trước.
 */
@RestController
@PreAuthorize("hasAuthority('sales.perform')")
public class OrderSaleSearchController {

    public record SaleOrderItem(UUID id, String code, Instant orderedAt, String customerName, BigDecimal total, String status,
                               String note) {
    }

    private final NamedParameterJdbcTemplate jdbc;

    public OrderSaleSearchController(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping("/api/orders/sale-search")
    public Map<String, Object> search(@RequestParam(required = false) String code,
                                      @RequestParam(required = false) String customer,
                                      @RequestParam(required = false) String note,
                                      @RequestParam(required = false) String productCode,
                                      @RequestParam(required = false) String productName,
                                      @RequestParam(required = false) Instant from, @RequestParam(required = false) Instant to,
                                      @RequestParam(required = false) UUID branchId,
                                      @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "10") int size) {
        var p = new MapSqlParameterSource();
        var w = new StringBuilder(" from customer_orders o join customers c on c.id = o.customer_id"
                + " where o.status in ('DRAFT', 'CONFIRMED')");
        if (like(p, "code", code)) w.append(" and o.code ilike :code");
        if (like(p, "customer", customer)) {
            w.append(" and (o.customer_name ilike :customer or c.code ilike :customer or c.phone ilike :customer)");
        }
        if (like(p, "note", note)) w.append(" and o.note ilike :note");
        if (like(p, "productCode", productCode)) {
            w.append(" and exists (select 1 from customer_order_lines l where l.order_id = o.id and l.product_code ilike :productCode)");
        }
        if (like(p, "productName", productName)) {
            w.append(" and exists (select 1 from customer_order_lines l where l.order_id = o.id and l.product_name ilike :productName)");
        }
        if (from != null) { w.append(" and o.ordered_at >= :from"); p.addValue("from", Timestamp.from(from)); }
        if (to != null) { w.append(" and o.ordered_at < :to"); p.addValue("to", Timestamp.from(to)); }
        if (branchId != null) { w.append(" and o.branch_id = :branchId"); p.addValue("branchId", branchId); }
        Long total = jdbc.queryForObject("select count(*)" + w, p, Long.class);
        int limit = Math.min(Math.max(size, 1), 50);
        p.addValue("limit", limit).addValue("offset", (long) Math.max(page, 0) * limit);
        var items = jdbc.query("select o.id, o.code, o.ordered_at, o.customer_name, o.total, o.status, o.note" + w
                + " order by o.ordered_at desc, o.code desc limit :limit offset :offset", p,
                (rs, n) -> new SaleOrderItem(rs.getObject("id", UUID.class), rs.getString("code"),
                        rs.getTimestamp("ordered_at").toInstant(), rs.getString("customer_name"), rs.getBigDecimal("total"),
                        rs.getString("status"), rs.getString("note")));
        return Map.of("items", items, "total", total == null ? 0L : total);
    }

    private static boolean like(MapSqlParameterSource p, String name, String v) {
        if (v == null || v.isBlank()) {
            return false;
        }
        p.addValue(name, "%" + v.trim() + "%");
        return true;
    }
}
