package com.vaxclinic.sales.order;

import com.vaxclinic.sales.order.OrderDtos.OrderListItem;
import com.vaxclinic.sales.order.OrderDtos.OrderListResponse;
import com.vaxclinic.sales.order.OrderDtos.OrderPayment;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.util.List;
import java.util.UUID;

/** SQL đọc của màn đặt hàng: danh sách có lọc + dòng tổng, phiếu thu cọc / chi hoàn cọc của đơn, mã hóa đơn. */
@Repository
public class OrderQueryRepository {

    private final NamedParameterJdbcTemplate jdbc;

    public OrderQueryRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public OrderListResponse search(OrderQuery.Filter f) {
        var p = new MapSqlParameterSource();
        String w = where(f, p);
        var agg = jdbc.queryForMap("select count(*) cnt, coalesce(sum(o.subtotal),0) sub, coalesce(sum(o.total),0) tot,"
                + " coalesce(sum(o.deposit),0) dep" + w, p);
        p.addValue("limit", f.size()).addValue("offset", (long) f.page() * f.size());
        var items = jdbc.query("select o.*, c.code customer_code, c.phone customer_phone, i.code invoice_code" + w
                + " order by o.ordered_at desc limit :limit offset :offset", p, (rs, n) -> item(rs));
        return new OrderListResponse(items, ((Number) agg.get("cnt")).longValue(), f.page(), f.size(),
                (BigDecimal) agg.get("sub"), (BigDecimal) agg.get("tot"), (BigDecimal) agg.get("dep"));
    }

    /** "Xuất file": tối đa 5.000 đơn khớp bộ lọc + dòng hàng của chúng. */
    public OrderDtos.ExportResponse export(OrderQuery.Filter f) {
        var p = new MapSqlParameterSource();
        String w = where(f, p);
        var items = jdbc.query("select o.*, c.code customer_code, c.phone customer_phone, i.code invoice_code" + w
                + " order by o.ordered_at desc limit 5000", p, (rs, n) -> item(rs));
        if (items.isEmpty()) {
            return new OrderDtos.ExportResponse(items, List.of());
        }
        var lines = jdbc.query("""
                select l.* from customer_order_lines l where l.order_id in (:ids) order by l.order_id, l.line_no""",
                new MapSqlParameterSource("ids", items.stream().map(OrderListItem::id).toList()),
                (rs, n) -> {
                    BigDecimal price = rs.getBigDecimal("unit_price").subtract(rs.getBigDecimal("discount"));
                    return new OrderDtos.ExportLine(rs.getObject("order_id", UUID.class), rs.getString("product_code"),
                            rs.getString("product_name"), rs.getString("unit_name"), rs.getBigDecimal("quantity"),
                            rs.getBigDecimal("unit_price"), rs.getBigDecimal("discount"),
                            rs.getBigDecimal("quantity").multiply(price).setScale(0, java.math.RoundingMode.HALF_UP));
                });
        return new OrderDtos.ExportResponse(items, lines);
    }

    /** Số lượng đã giao theo hàng + đơn vị = dòng của hóa đơn (còn hiệu lực) tạo từ đơn. */
    public java.util.Map<String, BigDecimal> deliveredByLine(UUID invoiceId) {
        var out = new java.util.HashMap<String, BigDecimal>();
        jdbc.query("""
                select l.product_id, l.unit_id, sum(l.quantity) q from invoice_lines l join invoices i on i.id = l.invoice_id
                where i.id = :id and i.status = 'COMPLETED' group by l.product_id, l.unit_id""",
                new MapSqlParameterSource("id", invoiceId), rs -> {
                    out.put(rs.getObject("product_id", UUID.class) + "|" + rs.getObject("unit_id", UUID.class), rs.getBigDecimal("q"));
                });
        return out;
    }

    private static OrderListItem item(java.sql.ResultSet rs) throws java.sql.SQLException {
        return new OrderListItem(rs.getObject("id", UUID.class), rs.getString("code"),
                rs.getTimestamp("ordered_at").toInstant(), rs.getString("customer_code"), rs.getString("customer_name"),
                rs.getString("created_by_name"), rs.getBigDecimal("subtotal"), rs.getBigDecimal("discount"),
                rs.getBigDecimal("total"), rs.getBigDecimal("deposit"), rs.getString("status"),
                rs.getString("invoice_code"),
                rs.getTimestamp("expected_delivery_at") == null ? null : rs.getTimestamp("expected_delivery_at").toInstant(),
                rs.getString("sales_channel"), rs.getString("seller_name"), rs.getString("customer_phone"),
                rs.getObject("invoice_id", UUID.class), rs.getString("receiver_province"), rs.getString("receiver_ward"));
    }

    private static String where(OrderQuery.Filter f, MapSqlParameterSource p) {
        var w = new StringBuilder(" from customer_orders o join customers c on c.id = o.customer_id"
                + " left join invoices i on i.id = o.invoice_id where 1=1");
        if (f.productQ() != null && !f.productQ().isBlank()) {
            w.append(" and exists (select 1 from customer_order_lines l where l.order_id = o.id"
                    + " and (l.product_code ilike :productQ or l.product_name ilike :productQ))");
            p.addValue("productQ", "%" + f.productQ().trim() + "%");
        }
        if (f.customerQ() != null && !f.customerQ().isBlank()) {
            w.append(" and (o.customer_name ilike :customerQ or c.code ilike :customerQ or c.phone ilike :customerQ)");
            p.addValue("customerQ", "%" + f.customerQ().trim() + "%");
        }
        if (f.deliveryFrom() != null) {
            w.append(" and o.expected_delivery_at >= :dfrom");
            p.addValue("dfrom", Timestamp.from(f.deliveryFrom()));
        }
        if (f.deliveryTo() != null) {
            w.append(" and o.expected_delivery_at < :dto");
            p.addValue("dto", Timestamp.from(f.deliveryTo()));
        }
        if (f.areas() != null && !f.areas().isEmpty()) { // mã Tỉnh/Thành (2 số) hoặc Phường/Xã (5 số)
            w.append(" and (o.receiver_province_code in (:areas) or o.receiver_ward_code in (:areas))");
            p.addValue("areas", f.areas());
        }
        if (f.sellerId() != null) {
            w.append(" and o.seller_id = :sellerId");
            p.addValue("sellerId", f.sellerId());
        }
        if (f.channels() != null && !f.channels().isEmpty()) {
            w.append(" and o.sales_channel in (:channels)");
            p.addValue("channels", f.channels());
        }
        if (f.paymentMethods() != null && !f.paymentMethods().isEmpty()) {
            w.append(" and exists (select 1 from cash_vouchers v where v.source_type = 'ORDER' and v.source_id = o.id"
                    + " and v.voucher_type = 'RECEIPT' and v.status = 'PAID' and v.fund in (:funds))");
            p.addValue("funds", f.paymentMethods());
        }
        if (f.q() != null && !f.q().isBlank()) {
            w.append(" and (o.code ilike :q or o.customer_name ilike :q or c.code ilike :q or c.phone ilike :q)");
            p.addValue("q", "%" + f.q().trim() + "%");
        }
        if (f.statuses() != null && !f.statuses().isEmpty()) {
            w.append(" and o.status in (:statuses)");
            p.addValue("statuses", f.statuses());
        }
        if (f.from() != null) {
            w.append(" and o.ordered_at >= :from");
            p.addValue("from", Timestamp.from(f.from()));
        }
        if (f.to() != null) {
            w.append(" and o.ordered_at < :to");
            p.addValue("to", Timestamp.from(f.to()));
        }
        if (f.createdBy() != null) {
            w.append(" and o.created_by = :createdBy");
            p.addValue("createdBy", f.createdBy());
        }
        if (f.customerId() != null) {
            w.append(" and o.customer_id = :customerId");
            p.addValue("customerId", f.customerId());
        }
        if (f.branchId() != null) {
            w.append(" and o.branch_id = :branchId");
            p.addValue("branchId", f.branchId());
        }
        return w.toString();
    }

    /** Phiếu thu cọc / phiếu chi hoàn cọc của đơn, theo thời gian. */
    public List<OrderPayment> payments(UUID orderId) {
        return jdbc.query("""
                select id, code, voucher_type, occurred_at, created_by_name, amount, fund, status from cash_vouchers
                where source_type = 'ORDER' and source_id = :id order by occurred_at, code""",
                new MapSqlParameterSource("id", orderId), (rs, n) -> new OrderPayment(rs.getObject("id", UUID.class),
                        rs.getString("code"), rs.getString("voucher_type"), rs.getTimestamp("occurred_at").toInstant(),
                        rs.getString("created_by_name"), rs.getBigDecimal("amount"), rs.getString("fund"), rs.getString("status")));
    }

    public String orderCode(UUID orderId) {
        return jdbc.queryForObject("select code from customer_orders where id = :id",
                new MapSqlParameterSource("id", orderId), String.class);
    }

    public String invoiceCode(UUID invoiceId) {
        return jdbc.queryForObject("select code from invoices where id = :id",
                new MapSqlParameterSource("id", invoiceId), String.class);
    }
}
