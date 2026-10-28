package com.vaxclinic.sales.invoice;

import com.vaxclinic.common.search.AccentInsensitiveSql;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Tra cứu hóa đơn cho màn bán hàng: giá bán gần nhất cho khách theo từng hàng / đơn vị, và
 * "Chọn hóa đơn trả hàng" (chỉ hóa đơn hoàn thành).
 */
@RestController
@PreAuthorize("hasAuthority('sales.perform')")
public class InvoiceSaleLookupController {

    public record LastPrice(UUID productId, UUID unitId, BigDecimal price, Instant soldAt, String invoiceCode) {
    }

    public record ReturnableItem(UUID id, String code, Instant soldAt, String employeeName, String customerName,
                                 BigDecimal total) {
    }

    private final NamedParameterJdbcTemplate jdbc;

    public InvoiceSaleLookupController(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Lần bán gần nhất (hóa đơn hoàn thành) cho khách của mỗi (hàng, đơn vị); price = đơn giá − giảm giá dòng. */
    @GetMapping("/api/invoices/last-prices")
    public List<LastPrice> lastPrices(@RequestParam UUID customerId, @RequestParam(required = false) List<UUID> productIds) {
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
    @GetMapping("/api/invoices/returnable")
    public Map<String, Object> returnable(@RequestParam(required = false) String code,
                                          @RequestParam(required = false) String shipmentCode,
                                          @RequestParam(required = false) String lot,
                                          @RequestParam(required = false) String customer,
                                          @RequestParam(required = false) String productCode,
                                          @RequestParam(required = false) String productName,
                                          @RequestParam(required = false) Instant from, @RequestParam(required = false) Instant to,
                                          @RequestParam(required = false) UUID branchId,
                                          @RequestParam(defaultValue = "desc") String sort,
                                          @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "7") int size) {
        var p = new MapSqlParameterSource();
        var w = new StringBuilder(" from invoices i left join customers c on c.id = i.customer_id where i.status = 'COMPLETED'");
        if (like(p, "code", code)) w.append(" and i.code ilike :code");
        if (like(p, "shipmentCode", shipmentCode)) {
            w.append(" and exists (select 1 from shipments s where s.invoice_id = i.id and s.code ilike :shipmentCode)");
        }
        if (like(p, "lot", lot)) {
            w.append(" and exists (select 1 from invoice_lines l join invoice_line_lots x on x.line_id = l.id"
                    + " where l.invoice_id = i.id and x.lot_number ilike :lot)");
        }
        if (like(p, "customer", customer)) {
            w.append(" and (" + AccentInsensitiveSql.like("coalesce(i.customer_name, 'Khách lẻ')", ":customer") + " or c.code ilike :customer"
                    + " or c.phone ilike :customer)");
        }
        if (like(p, "productCode", productCode)) {
            w.append(" and exists (select 1 from invoice_lines l where l.invoice_id = i.id and l.product_code ilike :productCode)");
        }
        if (like(p, "productName", productName)) {
            w.append(" and exists (select 1 from invoice_lines l where l.invoice_id = i.id and l.product_name ilike :productName)");
        }
        if (from != null) { w.append(" and i.sold_at >= :from"); p.addValue("from", Timestamp.from(from)); }
        if (to != null) { w.append(" and i.sold_at < :to"); p.addValue("to", Timestamp.from(to)); }
        if (branchId != null) { w.append(" and i.branch_id = :branchId"); p.addValue("branchId", branchId); }
        Long total = jdbc.queryForObject("select count(*)" + w, p, Long.class);
        int limit = Math.min(Math.max(size, 1), 50);
        p.addValue("limit", limit).addValue("offset", (long) Math.max(page, 0) * limit);
        String dir = "asc".equalsIgnoreCase(sort) ? "asc" : "desc";
        var items = jdbc.query("select i.id, i.code, i.sold_at, coalesce(i.seller_name, i.created_by_name) employee,"
                + " coalesce(i.customer_name, 'Khách lẻ') customer_name, i.total" + w
                + " order by i.sold_at " + dir + ", i.code " + dir + " limit :limit offset :offset", p,
                (rs, n) -> new ReturnableItem(rs.getObject("id", UUID.class), rs.getString("code"),
                        rs.getTimestamp("sold_at").toInstant(), rs.getString("employee"), rs.getString("customer_name"),
                        rs.getBigDecimal("total")));
        return Map.of("items", items, "total", total == null ? 0L : total);
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
