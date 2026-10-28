package com.vaxclinic.sales.salesreturn;

import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.salesreturn.SalesReturnDtos.LineResponse;
import com.vaxclinic.sales.salesreturn.SalesReturnDtos.ListItem;
import com.vaxclinic.sales.salesreturn.SalesReturnDtos.ReturnRequest;
import com.vaxclinic.sales.salesreturn.SalesReturnDtos.ReturnResponse;
import jakarta.validation.Valid;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** /api/sales-returns: khách trả hàng (Đơn hàng → Trả hàng). */
@RestController
@PreAuthorize("hasAuthority('sales.perform')")
public class SalesReturnController {

    private final SalesReturnService service;
    private final SalesReturnWriter writer;
    private final NamedParameterJdbcTemplate jdbc;
    private final AuditLogger audit;

    public SalesReturnController(SalesReturnService service, SalesReturnWriter writer, NamedParameterJdbcTemplate jdbc,
                                 AuditLogger audit) {
        this.service = service;
        this.writer = writer;
        this.jdbc = jdbc;
        this.audit = audit;
    }

    @GetMapping("/api/sales-returns")
    public Map<String, Object> list(@RequestParam(required = false) String q, @RequestParam(required = false) List<String> statuses,
                                    @RequestParam(required = false) Instant from, @RequestParam(required = false) Instant to,
                                    @RequestParam(required = false) UUID invoiceId,
                                    @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "15") int size) {
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
        return Map.of("items", items, "total", agg.get("cnt"), "sumTotal", agg.get("tot"));
    }

    @GetMapping("/api/sales-returns/{id}")
    public ReturnResponse get(@PathVariable UUID id) {
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

    @PostMapping("/api/sales-returns")
    public ReturnResponse create(@Valid @RequestBody ReturnRequest req, @AuthenticationPrincipal Jwt jwt) {
        boolean existed = writer.exists(req.id());
        ReturnResponse r = get(service.create(req, Actor.of(jwt), jwt.getTokenValue()));
        if (!existed) {
            Actor.of(jwt).audit(audit, r.branchId(), "Trả hàng", "Tạo", r.code(), "Tạo phiếu trả hàng " + r.code()
                    + (r.invoiceCode() == null ? " (trả nhanh)" : " theo hóa đơn " + r.invoiceCode())
                    + ", khách " + r.customerName() + ", cần trả khách " + Actor.money(r.total()));
        }
        return r;
    }

    @PostMapping("/api/sales-returns/{id}/cancel")
    @PreAuthorize("hasAuthority('sales.cancel')")
    public ReturnResponse cancel(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        service.cancel(id, Actor.of(jwt));
        ReturnResponse r = get(id);
        Actor.of(jwt).audit(audit, r.branchId(), "Trả hàng", "Hủy", r.code(), "Hủy phiếu trả hàng " + r.code()
                + (r.invoiceCode() == null ? " (trả nhanh)" : " của hóa đơn " + r.invoiceCode()));
        return r;
    }
}
