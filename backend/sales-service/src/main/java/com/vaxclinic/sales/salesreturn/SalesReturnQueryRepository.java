package com.vaxclinic.sales.salesreturn;

import com.vaxclinic.sales.salesreturn.SalesReturnDtos.LineResponse;
import com.vaxclinic.sales.salesreturn.SalesReturnDtos.ListItem;
import com.vaxclinic.sales.salesreturn.SalesReturnDtos.ReturnResponse;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.RoundingMode;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Đọc phiếu trả hàng: danh sách có lọc + tổng, chi tiết kèm dòng hàng. Ghi phiếu ở {@link SalesReturnWriter}. */
@Repository
public class SalesReturnQueryRepository {

    /** Bộ lọc danh sách (giá trị trống = bỏ qua). */
    /** types: INVOICE / QUICK / SHIPMENT; deliveryStatuses / partnerId: theo vận đơn bán của phiếu. */
    public record Filter(String q, List<String> statuses, Instant from, Instant to, UUID invoiceId, List<String> types,
                         List<String> deliveryStatuses, UUID partnerId) {
        public Filter(String q, List<String> statuses, Instant from, Instant to, UUID invoiceId) {
            this(q, statuses, from, to, invoiceId, null, null, null);
        }
    }

    private static final String TABLES = " " + """
             from sales_returns r left join invoices i on i.id = r.invoice_id
             left join customers c on c.id = r.customer_id
             left join lateral (select sh.code, sh.status, sh.partner_id, (sh.return_id = r.id) is_return from shipments sh
               where sh.return_id = r.id or (r.invoice_id is not null and sh.invoice_id = r.invoice_id and sh.status <> 'CANCELLED')
               order by (sh.return_id = r.id) desc nulls last, sh.created_at desc limit 1) ss on true
             left join delivery_partners dp on dp.id = ss.partner_id""";
    private static final String TYPE = "(case when r.invoice_id is null then 'QUICK' when coalesce(ss.is_return, false) then 'SHIPMENT'"
            + " else 'INVOICE' end)";
    private static final String COLS = "select r.*, i.code invoice_code, i.seller_name, c.code customer_code, ss.code ship_code,"
            + " ss.status ship_status, dp.name partner_name, " + TYPE + " rtype,"
            + " (select ch.name from sales_channels ch where ch.code = i.sales_channel) channel_name";

    /** total: số phiếu khớp bộ lọc; sumTotal: tổng "cần trả khách". */
    public record Page(List<ListItem> items, Object total, Object sumTotal) {
    }

    private final NamedParameterJdbcTemplate jdbc;

    public SalesReturnQueryRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Mới nhất trước, trang [offset, offset + limit). */
    public Page list(Filter f, int limit, long offset) {
        var p = new MapSqlParameterSource();
        var w = new StringBuilder(TABLES).append(" where 1=1");
        if (f.types() != null && !f.types().isEmpty()) { w.append(" and ").append(TYPE).append(" in (:types)"); p.addValue("types", f.types()); }
        if (f.deliveryStatuses() != null && !f.deliveryStatuses().isEmpty()) { w.append(" and ss.status in (:dstatuses)"); p.addValue("dstatuses", f.deliveryStatuses()); }
        if (f.partnerId() != null) { w.append(" and ss.partner_id = :partner"); p.addValue("partner", f.partnerId()); }
        if (f.q() != null && !f.q().isBlank()) { w.append(" and (r.code ilike :q or i.code ilike :q or r.customer_name ilike :q)"); p.addValue("q", "%" + f.q().trim() + "%"); }
        if (f.statuses() != null && !f.statuses().isEmpty()) { w.append(" and r.status in (:statuses)"); p.addValue("statuses", f.statuses()); }
        if (f.from() != null) { w.append(" and r.returned_at >= :from"); p.addValue("from", Timestamp.from(f.from())); }
        if (f.to() != null) { w.append(" and r.returned_at < :to"); p.addValue("to", Timestamp.from(f.to())); }
        if (f.invoiceId() != null) { w.append(" and r.invoice_id = :invoiceId"); p.addValue("invoiceId", f.invoiceId()); }
        var agg = jdbc.queryForMap("select count(*) cnt, coalesce(sum(r.total),0) tot" + w, p);
        p.addValue("limit", limit).addValue("offset", offset);
        var items = jdbc.query(COLS + w + " order by r.returned_at desc limit :limit offset :offset", p, (rs, n) -> item(rs));
        return new Page(items, agg.get("cnt"), agg.get("tot"));
    }

    /** "Xuất file": mọi phiếu khớp bộ lọc (tối đa 5.000) + dòng hàng của chúng. */
    public SalesReturnDtos.ExportResponse export(Filter f) {
        var page = list(f, 5000, 0);
        if (page.items().isEmpty()) {
            return new SalesReturnDtos.ExportResponse(List.of(), List.of());
        }
        var ids = page.items().stream().map(ListItem::id).toList();
        var lines = jdbc.query("select * from sales_return_lines where return_id in (:ids) order by return_id, product_name",
                new MapSqlParameterSource("ids", ids), (rs, n) -> new SalesReturnDtos.ExportLine(rs.getObject("return_id", UUID.class),
                        rs.getString("product_code"), rs.getString("product_name"), rs.getString("unit_name"), rs.getBigDecimal("quantity"),
                        rs.getBigDecimal("unit_price"),
                        rs.getBigDecimal("quantity").multiply(rs.getBigDecimal("unit_price")).setScale(0, RoundingMode.HALF_UP)));
        return new SalesReturnDtos.ExportResponse(page.items(), lines);
    }

    private static ListItem item(java.sql.ResultSet rs) throws java.sql.SQLException {
        return new ListItem(rs.getObject("id", UUID.class), rs.getString("code"), rs.getTimestamp("returned_at").toInstant(),
                rs.getString("invoice_code"), rs.getString("customer_name"), rs.getBigDecimal("subtotal"),
                rs.getBigDecimal("fee"), rs.getBigDecimal("total"), rs.getBigDecimal("refunded"), rs.getString("status"),
                rs.getString("rtype"), rs.getObject("invoice_id", UUID.class), rs.getString("customer_code"),
                rs.getObject("branch_id", UUID.class), rs.getString("seller_name"), rs.getTimestamp("created_at").toInstant(),
                rs.getString("created_by_name"), rs.getString("channel_name"), rs.getString("note"), rs.getBigDecimal("discount"),
                rs.getString("ship_code"), rs.getString("ship_status"), rs.getString("partner_name"));
    }

    /** Dòng hàng của phiếu, theo tên hàng. */
    public List<LineResponse> lines(UUID id) {
        return jdbc.query("select * from sales_return_lines where return_id = :id order by product_name", new MapSqlParameterSource("id", id),
                (rs, n) -> new LineResponse(rs.getObject("id", UUID.class), rs.getObject("invoice_line_id", UUID.class),
                        rs.getString("product_code"), rs.getString("product_name"), rs.getString("unit_name"),
                        rs.getBigDecimal("quantity"), rs.getBigDecimal("unit_price"),
                        rs.getBigDecimal("quantity").multiply(rs.getBigDecimal("unit_price")).setScale(0, RoundingMode.HALF_UP),
                        rs.getString("lots")));
    }

    /** Phiếu kèm mã hóa đơn gốc và các dòng đã đọc; phiếu phải tồn tại (kiểm tra trước bằng SalesReturnWriter.find). */
    public ReturnResponse detail(UUID id, List<LineResponse> lines) {
        return jdbc.queryForObject("select r.*, i.code invoice_code from sales_returns r left join invoices i on i.id = r.invoice_id where r.id = :id",
                new MapSqlParameterSource("id", id), (rs, n) -> new ReturnResponse(rs.getObject("id", UUID.class), rs.getString("code"),
                        rs.getObject("invoice_id", UUID.class), rs.getString("invoice_code"), rs.getObject("branch_id", UUID.class),
                        rs.getObject("customer_id", UUID.class), rs.getString("customer_name"), rs.getString("created_by_name"),
                        rs.getTimestamp("returned_at").toInstant(), rs.getString("status"), rs.getBigDecimal("subtotal"),
                        rs.getBigDecimal("discount"), rs.getBigDecimal("fee"), rs.getBigDecimal("total"),
                        rs.getBigDecimal("refunded"), rs.getString("payment_method"), rs.getString("note"), lines));
    }
}
