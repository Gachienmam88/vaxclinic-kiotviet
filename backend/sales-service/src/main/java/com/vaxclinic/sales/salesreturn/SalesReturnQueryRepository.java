package com.vaxclinic.sales.salesreturn;

import com.vaxclinic.sales.salesreturn.SalesReturnDtos.LineResponse;
import com.vaxclinic.sales.salesreturn.SalesReturnDtos.ListItem;
import com.vaxclinic.sales.salesreturn.SalesReturnDtos.ReturnResponse;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Đọc phiếu trả hàng: danh sách có lọc + tổng, chi tiết kèm dòng hàng. Ghi phiếu ở {@link SalesReturnWriter}. */
@Repository
public class SalesReturnQueryRepository {

    /** Bộ lọc danh sách (giá trị trống = bỏ qua). */
    public record Filter(String q, List<String> statuses, Instant from, Instant to, UUID invoiceId) {
    }

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
        var w = new StringBuilder(" from sales_returns r left join invoices i on i.id = r.invoice_id where 1=1");
        if (f.q() != null && !f.q().isBlank()) { w.append(" and (r.code ilike :q or i.code ilike :q or r.customer_name ilike :q)"); p.addValue("q", "%" + f.q().trim() + "%"); }
        if (f.statuses() != null && !f.statuses().isEmpty()) { w.append(" and r.status in (:statuses)"); p.addValue("statuses", f.statuses()); }
        if (f.from() != null) { w.append(" and r.returned_at >= :from"); p.addValue("from", Timestamp.from(f.from())); }
        if (f.to() != null) { w.append(" and r.returned_at < :to"); p.addValue("to", Timestamp.from(f.to())); }
        if (f.invoiceId() != null) { w.append(" and r.invoice_id = :invoiceId"); p.addValue("invoiceId", f.invoiceId()); }
        var agg = jdbc.queryForMap("select count(*) cnt, coalesce(sum(r.total),0) tot" + w, p);
        p.addValue("limit", limit).addValue("offset", offset);
        var items = jdbc.query("select r.*, i.code invoice_code" + w + " order by r.returned_at desc limit :limit offset :offset", p,
                (rs, n) -> new ListItem(rs.getObject("id", UUID.class), rs.getString("code"), rs.getTimestamp("returned_at").toInstant(),
                        rs.getString("invoice_code"), rs.getString("customer_name"), rs.getBigDecimal("subtotal"),
                        rs.getBigDecimal("fee"), rs.getBigDecimal("total"), rs.getBigDecimal("refunded"), rs.getString("status")));
        return new Page(items, agg.get("cnt"), agg.get("tot"));
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
