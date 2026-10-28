package com.vaxclinic.sales.report;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.sales.common.Actor;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Báo cáo bán hàng theo hàng hóa (và Hàng bán theo khách / theo nhân viên). Doanh thu dòng = phân bổ giảm giá hóa đơn
 * theo tỷ lệ tiền hàng (cùng công thức Sổ doanh thu S1a/S2a); giá trị trả = phân bổ (tiền hàng trả − giảm giá phiếu trả).
 * merge = Gộp hàng hóa cùng loại: gộp mọi đơn vị tính của 1 hàng, số lượng quy về đơn vị cơ bản (theo lô đã xuất / nhập lại).
 */
@RestController
@PreAuthorize("hasAuthority('report.view')")
public class ProductSalesReportController {

    public record ProductRow(String key, UUID productId, String code, String name, String unit, String dimKey, String dimName,
                             BigDecimal qtySold, BigDecimal revenue, BigDecimal qtyReturned, BigDecimal returnValue,
                             BigDecimal cogs) {
    }

    /** Chiều phụ: (khóa, tên) cho dòng bán (i, c) và dòng trả (r, i gốc, c của phiếu trả). */
    private static final Map<String, String[]> DIMS = Map.of(
            "NONE", new String[]{"''", "''", "''", "''"},
            "CUSTOMER", new String[]{"coalesce(i.customer_id::text, '')", "coalesce(c.code || ' - ', '') || coalesce(c.name, i.customer_name, 'Khách lẻ')",
                    "coalesce(r.customer_id::text, '')", "coalesce(c.code || ' - ', '') || coalesce(c.name, r.customer_name, 'Khách lẻ')"},
            "SELLER", new String[]{"coalesce(i.seller_id, i.created_by)::text", "coalesce(i.seller_name, i.created_by_name)",
                    "coalesce(i.seller_id, i.created_by)::text", "coalesce(i.seller_name, i.created_by_name)"});

    private final NamedParameterJdbcTemplate jdbc;

    public ProductSalesReportController(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping("/api/reports/sales/products")
    public List<ProductRow> products(ReportFilter f, @RequestParam(defaultValue = "NONE") String by,
                                     @RequestParam(defaultValue = "false") boolean merge, @AuthenticationPrincipal Jwt jwt) {
        String[] d = DIMS.get(by);
        if (d == null) {
            throw BusinessException.badRequest("REPORT_GROUP_INVALID", "Kiểu nhóm báo cáo không hợp lệ");
        }
        String saleKey = merge ? "l.product_id::text" : "l.product_code";
        String retKey = merge ? "rl.product_id::text" : "rl.product_code";
        String saleQty = merge ? "coalesce((select sum(x.base_qty) from invoice_line_lots x where x.line_id = l.id), l.quantity)" : "l.quantity";
        String retQty = merge ? "coalesce((select sum(x.base_qty) from sales_return_line_lots x where x.return_line_id = rl.id), rl.quantity)" : "rl.quantity";
        return jdbc.query("""
                with x as (
                  select %s k, l.product_id, l.product_code code, l.product_name pname, l.unit_name unit, %s dk, %s dn,
                    %s qs, case when i.subtotal = 0 then 0 else round(i.total * l.quantity * (l.unit_price - l.discount) / i.subtotal) end rev,
                    0 qr, 0 rv, round(l.quantity * l.cost) cogs
                  from invoices i join invoice_lines l on l.invoice_id = i.id left join customers c on c.id = i.customer_id
                  where %s%s
                  union all
                  select %s, rl.product_id, rl.product_code, rl.product_name, rl.unit_name, %s, %s, 0, 0, %s,
                    case when r.subtotal = 0 then 0 else round((r.subtotal - r.discount) * rl.quantity * rl.unit_price / r.subtotal) end,
                    -round(rl.quantity * coalesce(il.cost, 0))
                  from sales_returns r join sales_return_lines rl on rl.return_id = r.id join invoices i on i.id = r.invoice_id
                  left join invoice_lines il on il.id = rl.invoice_line_id left join customers c on c.id = r.customer_id
                  where %s%s
                )
                select k, (array_agg(product_id))[1] product_id, min(code) code, min(pname) pname, min(unit) unit, dk, max(dn) dn,
                  sum(qs) qs, sum(rev) rev, sum(qr) qr, sum(rv) rv, sum(cogs) cogs
                from x group by k, dk order by sum(rev) - sum(rv) desc, min(code)""".formatted(
                saleKey, d[0], d[1], saleQty, f.invoiceWhere(), f.productMatch("l"),
                retKey, d[2], d[3], retQty, f.returnWhere(), f.productMatch("rl")), f.params(Actor.of(jwt)),
                (rs, n) -> new ProductRow(rs.getString("k"), rs.getObject("product_id", UUID.class), rs.getString("code"),
                        rs.getString("pname"), merge ? null : rs.getString("unit"), rs.getString("dk"), rs.getString("dn"),
                        rs.getBigDecimal("qs"), rs.getBigDecimal("rev"), rs.getBigDecimal("qr"), rs.getBigDecimal("rv"),
                        rs.getBigDecimal("cogs")));
    }
}
