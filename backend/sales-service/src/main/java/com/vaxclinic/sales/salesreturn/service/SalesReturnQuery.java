package com.vaxclinic.sales.salesreturn.service;

import com.vaxclinic.sales.salesreturn.dto.SalesReturnDtos;
import com.vaxclinic.sales.salesreturn.dto.SalesReturnDtos.LineResponse;
import com.vaxclinic.sales.salesreturn.dto.SalesReturnDtos.ListItem;
import com.vaxclinic.sales.salesreturn.dto.SalesReturnDtos.ListPage;
import com.vaxclinic.sales.salesreturn.dto.SalesReturnDtos.ReturnResponse;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.math.BigDecimal;
import java.util.UUID;

/** Đọc phiếu trả hàng: danh sách (có tổng) và chi tiết kèm dòng hàng. */
@Component
public class SalesReturnQuery {

    private final NamedParameterJdbcTemplate jdbc;
    private final SalesReturnWriter writer;

    public SalesReturnQuery(NamedParameterJdbcTemplate jdbc, SalesReturnWriter writer) {
        this.jdbc = jdbc;
        this.writer = writer;
    }

    public ListPage list(String q, List<String> statuses, Instant from, Instant to, UUID invoiceId, int page, int size) {
        var p = new MapSqlParameterSource();
        var w = new StringBuilder(" from sales_returns r left join invoices i on i.id = r.invoice_id where 1=1");
        if (q != null && !q.isBlank()) { w.append(" and (r.code ilike :q or i.code ilike :q or r.customer_name ilike :q)"); p.addValue("q", "%" + q.trim() + "%"); }
        if (statuses != null && !statuses.isEmpty()) { w.append(" and r.status in (:statuses)"); p.addValue("statuses", statuses); }
        if (from != null) { w.append(" and r.returned_at >= :from"); p.addValue("from", Timestamp.from(from)); }
        if (to != null) { w.append(" and r.returned_at < :to"); p.addValue("to", Timestamp.from(to)); }
        if (invoiceId != null) { w.append(" and r.invoice_id = :invoiceId"); p.addValue("invoiceId", invoiceId); }
        var agg = jdbc.queryForMap("select count(*) cnt, coalesce(sum(r.total),0) tot" + w, p);
        p.addValue("limit", Math.min(Math.max(size, 1), 100)).addValue("offset", (long) Math.max(page, 0) * size);
        var items = jdbc.query("select r.*, i.code invoice_code" + w + " order by r.returned_at desc limit :limit offset :offset", p,
                (rs, n) -> new ListItem(rs.getObject("id", UUID.class), rs.getString("code"), rs.getTimestamp("returned_at").toInstant(),
                        rs.getString("invoice_code"), rs.getString("customer_name"), rs.getBigDecimal("subtotal"),
                        rs.getBigDecimal("fee"), rs.getBigDecimal("total"), rs.getBigDecimal("refunded"), rs.getString("status")));
        return new ListPage(items, ((Number) agg.get("cnt")).longValue(), (BigDecimal) agg.get("tot"));
    }

    public ReturnResponse get(UUID id) {
        var params = new MapSqlParameterSource("id", id);
        var lines = jdbc.query("select * from sales_return_lines where return_id = :id order by product_name", params,
                (rs, n) -> new LineResponse(rs.getObject("id", UUID.class), rs.getObject("invoice_line_id", UUID.class),
                        rs.getString("product_code"), rs.getString("product_name"), rs.getString("unit_name"),
                        rs.getBigDecimal("quantity"), rs.getBigDecimal("unit_price"),
                        rs.getBigDecimal("quantity").multiply(rs.getBigDecimal("unit_price")).setScale(0, java.math.RoundingMode.HALF_UP),
                        rs.getString("lots")));
        writer.find(id); // 404 nếu không có
        return jdbc.queryForObject("select r.*, i.code invoice_code from sales_returns r left join invoices i on i.id = r.invoice_id where r.id = :id",
                params, (rs, n) -> new ReturnResponse(rs.getObject("id", UUID.class), rs.getString("code"),
                        rs.getObject("invoice_id", UUID.class), rs.getString("invoice_code"), rs.getObject("branch_id", UUID.class),
                        rs.getObject("customer_id", UUID.class), rs.getString("customer_name"), rs.getString("created_by_name"),
                        rs.getTimestamp("returned_at").toInstant(), rs.getString("status"), rs.getBigDecimal("subtotal"),
                        rs.getBigDecimal("discount"), rs.getBigDecimal("fee"), rs.getBigDecimal("total"),
                        rs.getBigDecimal("refunded"), rs.getString("payment_method"), rs.getString("note"), lines));
    }
}
