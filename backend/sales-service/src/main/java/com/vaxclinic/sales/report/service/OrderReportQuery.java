package com.vaxclinic.sales.report.service;

import com.vaxclinic.sales.report.dto.ReportFilter;
import com.vaxclinic.sales.common.Actor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Báo cáo đặt hàng: theo Hàng hóa (SL đặt, giá trị đặt đã phân bổ giảm giá đơn, SL đã tạo hóa đơn) và theo Giao dịch
 * (từng đơn). Lọc theo thời gian đặt hàng, trạng thái, khách hàng, hàng hóa (q: mã / tên). Đơn chưa có ngày giao hàng
 * riêng nên "Thời gian giao hàng" chỉ có Toàn thời gian.
 */
@Component
public class OrderReportQuery {

    public record OrderProductRow(String key, UUID productId, String code, String name, String unit, BigDecimal qty,
                                  BigDecimal value, BigDecimal invoicedQty, long orderCount) {
    }

    public record OrderRow(UUID id, String code, Instant orderedAt, String customerName, String status, BigDecimal qty,
                           BigDecimal subtotal, BigDecimal discount, BigDecimal total, BigDecimal deposit, String invoiceCode) {
    }

    private final NamedParameterJdbcTemplate jdbc;

    public OrderReportQuery(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<OrderProductRow> products(ReportFilter f, List<String> statuses, boolean merge, Actor actor) {
        String key = merge ? "l.product_id::text" : "l.product_code";
        return jdbc.query("""
                select %s k, (array_agg(l.product_id))[1] product_id, min(l.product_code) code, min(l.product_name) pname,
                  min(l.unit_name) unit, sum(l.quantity) qty, count(distinct o.id) n,
                  sum(case when o.subtotal = 0 then 0 else round(o.total * l.quantity * (l.unit_price - l.discount) / o.subtotal) end) val,
                  sum(case when o.status = 'COMPLETED' then l.quantity else 0 end) invoiced
                from customer_orders o join customer_order_lines l on l.order_id = o.id
                where %s%s group by 1 order by qty desc, code""".formatted(key, where(f, statuses), f.productMatch("l")),
                params(f, statuses, actor), (rs, n) -> new OrderProductRow(rs.getString("k"), rs.getObject("product_id", UUID.class),
                        rs.getString("code"), rs.getString("pname"), merge ? null : rs.getString("unit"), rs.getBigDecimal("qty"),
                        rs.getBigDecimal("val"), rs.getBigDecimal("invoiced"), rs.getLong("n")));
    }

    public List<OrderRow> transactions(ReportFilter f, List<String> statuses, Actor actor) {
        String product = f.q() == null || f.q().isBlank() ? "" : " and exists (select 1 from customer_order_lines l where l.order_id = o.id"
                + f.productMatch("l") + ")";
        return jdbc.query("""
                select o.*, (select coalesce(sum(l.quantity), 0) from customer_order_lines l where l.order_id = o.id) qty,
                  (select code from invoices x where x.id = o.invoice_id) invoice_code
                from customer_orders o where %s%s order by o.ordered_at""".formatted(where(f, statuses), product),
                params(f, statuses, actor), (rs, n) -> new OrderRow(rs.getObject("id", UUID.class), rs.getString("code"),
                        rs.getTimestamp("ordered_at").toInstant(), rs.getString("customer_name"), rs.getString("status"),
                        rs.getBigDecimal("qty"), rs.getBigDecimal("subtotal"), rs.getBigDecimal("discount"),
                        rs.getBigDecimal("total"), rs.getBigDecimal("deposit"), rs.getString("invoice_code")));
    }

    private static String where(ReportFilter f, List<String> statuses) {
        var w = new StringBuilder("o.ordered_at >= :from and o.ordered_at < :to and o.branch_id in (:branches)");
        if (f.customerId() != null) w.append(" and o.customer_id = :customerId");
        if (f.createdBy() != null) w.append(" and o.created_by = :createdBy");
        if (statuses != null && !statuses.isEmpty()) w.append(" and o.status in (:statuses)");
        w.append(f.docMeta("o")).append(f.deliveryWhere());
        return w.toString();
    }

    private static MapSqlParameterSource params(ReportFilter f, List<String> statuses, Actor actor) {
        return f.params(actor).addValue("statuses", statuses == null || statuses.isEmpty() ? List.of("-") : statuses);
    }
}
