package com.vaxclinic.sales.invoice.service;

import com.vaxclinic.common.search.AccentInsensitiveSql;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Tra cứu hóa đơn cho màn bán hàng: giá bán gần nhất cho khách theo từng hàng / đơn vị, và
 * "Chọn hóa đơn trả hàng" (chỉ hóa đơn hoàn thành).
 */
@Component
public class InvoiceSaleLookupQuery {

    public record LastPrice(UUID productId, UUID unitId, BigDecimal price, Instant soldAt, String invoiceCode) {
    }

    public record ReturnableItem(UUID id, String code, Instant soldAt, String employeeName, String customerName,
                                 BigDecimal total) {
    }

    public record ReturnablePage(List<ReturnableItem> items, long total) {
    }

    /** Bộ lọc "Chọn hóa đơn trả hàng". */
    public record ReturnableFilter(String code, String shipmentCode, String lot, String customer, String productCode,
                                   String productName, Instant from, Instant to, UUID branchId, String sort, int page, int size) {
    }

    private final NamedParameterJdbcTemplate jdbc;

    public InvoiceSaleLookupQuery(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Lần bán gần nhất (hóa đơn hoàn thành) cho khách của mỗi (hàng, đơn vị); price = đơn giá − giảm giá dòng. */
    public List<LastPrice> lastPrices(UUID customerId, List<UUID> productIds) {
        boolean all = productIds == null || productIds.isEmpty();
        var p = new MapSqlParameterSource("customerId", customerId)
                .addValue("productIds", all ? List.of(new UUID(0, 0)) : productIds).addValue("all", all);
        return jdbc.query("""
                select distinct on (l.product_id, l.unit_id) l.product_id, l.unit_id, l.unit_price - l.discount price,
                  i.sold_at, i.code
                from invoice_lines l join invoices i on i.id = l.invoice_id
                where i.customer_id = :customerId and i.status = 'COMPLETED' and (:all or l.product_id in (:productIds))
                order by l.product_id, l.unit_id, i.sold_at desc, i.code desc""", p,
                (rs, n) -> new LastPrice(rs.getObject("product_id", UUID.class), rs.getObject("unit_id", UUID.class),
                        rs.getBigDecimal("price"), rs.getTimestamp("sold_at").toInstant(), rs.getString("code")));
    }

    /** "Chọn hóa đơn trả hàng": lọc theo mã HĐ / mã vận đơn / lô / khách / hàng / thời gian / chi nhánh; mặc định 7 dòng. */
    public ReturnablePage returnable(ReturnableFilter f) {
        var p = new MapSqlParameterSource();
        var w = new StringBuilder(" from invoices i left join customers c on c.id = i.customer_id where i.status = 'COMPLETED'");
        if (like(p, "code", f.code())) w.append(" and i.code ilike :code");
        if (like(p, "shipmentCode", f.shipmentCode())) {
            w.append(" and exists (select 1 from shipments s where s.invoice_id = i.id and s.code ilike :shipmentCode)");
        }
        if (like(p, "lot", f.lot())) {
            w.append(" and exists (select 1 from invoice_lines l join invoice_line_lots x on x.line_id = l.id"
                    + " where l.invoice_id = i.id and x.lot_number ilike :lot)");
        }
        if (like(p, "customer", f.customer())) {
            w.append(" and (" + AccentInsensitiveSql.like("coalesce(i.customer_name, 'Khách lẻ')", ":customer") + " or c.code ilike :customer"
                    + " or c.phone ilike :customer)");
        }
        if (like(p, "productCode", f.productCode())) {
            w.append(" and exists (select 1 from invoice_lines l where l.invoice_id = i.id and l.product_code ilike :productCode)");
        }
        if (like(p, "productName", f.productName())) {
            w.append(" and exists (select 1 from invoice_lines l where l.invoice_id = i.id and l.product_name ilike :productName)");
        }
        if (f.from() != null) { w.append(" and i.sold_at >= :from"); p.addValue("from", Timestamp.from(f.from())); }
        if (f.to() != null) { w.append(" and i.sold_at < :to"); p.addValue("to", Timestamp.from(f.to())); }
        if (f.branchId() != null) { w.append(" and i.branch_id = :branchId"); p.addValue("branchId", f.branchId()); }
        Long total = jdbc.queryForObject("select count(*)" + w, p, Long.class);
        int limit = Math.min(Math.max(f.size(), 1), 50);
        p.addValue("limit", limit).addValue("offset", (long) Math.max(f.page(), 0) * limit);
        String dir = "asc".equalsIgnoreCase(f.sort()) ? "asc" : "desc";
        var items = jdbc.query("select i.id, i.code, i.sold_at, coalesce(i.seller_name, i.created_by_name) employee,"
                + " coalesce(i.customer_name, 'Khách lẻ') customer_name, i.total" + w
                + " order by i.sold_at " + dir + ", i.code " + dir + " limit :limit offset :offset", p,
                (rs, n) -> new ReturnableItem(rs.getObject("id", UUID.class), rs.getString("code"),
                        rs.getTimestamp("sold_at").toInstant(), rs.getString("employee"), rs.getString("customer_name"),
                        rs.getBigDecimal("total")));
        return new ReturnablePage(items, total == null ? 0L : total);
    }

    /** Thêm tham số ILIKE '%v%' nếu có giá trị. */
    private static boolean like(MapSqlParameterSource p, String name, String v) {
        if (v == null || v.isBlank()) {
            return false;
        }
        p.addValue(name, "%" + v.trim() + "%");
        return true;
    }
}
