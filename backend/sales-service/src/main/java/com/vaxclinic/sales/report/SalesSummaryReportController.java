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

/**
 * Tổng hợp doanh thu theo 1 chiều: ngày (Báo cáo bán hàng – Thời gian), người bán (Nhân viên), chi nhánh, khách hàng,
 * kênh bán. Giá trị trả = tiền hàng trả − giảm giá phiếu trả (phí trả hàng không trừ doanh thu, tách riêng cột fee).
 * Doanh thu thuần = revenue − returnValue; giá vốn = giá vốn hàng bán − giá vốn hàng trả (theo giá vốn lúc bán).
 */
@RestController
@PreAuthorize("hasAuthority('report.view')")
public class SalesSummaryReportController {

    public record SummaryRow(String key, String code, String name, long invoiceCount, long returnCount, BigDecimal qty,
                             BigDecimal subtotal, BigDecimal discount, BigDecimal revenue, BigDecimal returnValue,
                             BigDecimal fee, BigDecimal cogs) {
    }

    /** Biểu thức (khóa, mã, tên) cho hóa đơn (i, c = khách) và phiếu trả (r, i = HĐ gốc, c = khách của phiếu trả). */
    private record Dim(String invKey, String retKey, String code, String invName, String retName) {
    }

    private static final String DAY = "to_char(%s at time zone " + ReportFilter.TZ + ", 'YYYY-MM-DD')";
    private static final Map<String, Dim> DIMS = Map.of(
            "DAY", new Dim(DAY.formatted("i.sold_at"), DAY.formatted("r.returned_at"), "''", "''", "''"),
            "SELLER", new Dim("coalesce(i.seller_id, i.created_by)::text", "coalesce(i.seller_id, i.created_by)::text", "''",
                    "coalesce(i.seller_name, i.created_by_name)", "coalesce(i.seller_name, i.created_by_name)"),
            "BRANCH", new Dim("i.branch_id::text", "r.branch_id::text", "''", "''", "''"),
            "CUSTOMER", new Dim("coalesce(i.customer_id::text, '')", "coalesce(r.customer_id::text, '')", "coalesce(c.code, '')",
                    "coalesce(c.name, i.customer_name, 'Khách lẻ')", "coalesce(c.name, r.customer_name, 'Khách lẻ')"),
            "CHANNEL", new Dim("'DIRECT'", "'DIRECT'", "''", "'Bán trực tiếp'", "'Bán trực tiếp'"));

    private final NamedParameterJdbcTemplate jdbc;

    public SalesSummaryReportController(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** groupBy: DAY | SELLER | BRANCH | CUSTOMER | CHANNEL (ứng dụng chưa có kênh bán → mọi hóa đơn là "Bán trực tiếp"). */
    @GetMapping("/api/reports/sales/summary")
    public List<SummaryRow> summary(ReportFilter f, @RequestParam(defaultValue = "DAY") String groupBy,
                                    @AuthenticationPrincipal Jwt jwt) {
        Dim d = DIMS.get(groupBy);
        if (d == null) {
            throw BusinessException.badRequest("REPORT_GROUP_INVALID", "Kiểu nhóm báo cáo không hợp lệ");
        }
        return jdbc.query("""
                with x as (
                  select %s k, %s code, %s name, 1 inv, 0 ret, i.subtotal, i.discount, i.total revenue, 0 rv, 0 fee,
                    (select coalesce(sum(l.quantity), 0) from invoice_lines l where l.invoice_id = i.id) qty,
                    (select coalesce(sum(round(l.quantity * l.cost)), 0) from invoice_lines l where l.invoice_id = i.id) cogs
                  from invoices i left join customers c on c.id = i.customer_id where %s
                  union all
                  select %s, %s, %s, 0, 1, 0, 0, 0, r.subtotal - r.discount, r.fee, 0,
                    -(select coalesce(sum(round(rl.quantity * coalesce(il.cost, 0))), 0) from sales_return_lines rl
                      left join invoice_lines il on il.id = rl.invoice_line_id where rl.return_id = r.id)
                  from sales_returns r join invoices i on i.id = r.invoice_id left join customers c on c.id = r.customer_id where %s
                )
                select k, max(code) code, max(name) name, sum(inv) inv, sum(ret) ret, sum(qty) qty, sum(subtotal) subtotal,
                  sum(discount) discount, sum(revenue) revenue, sum(rv) rv, sum(fee) fee, sum(cogs) cogs
                from x group by k order by k""".formatted(d.invKey(), d.code(), d.invName(), f.invoiceWhere(),
                d.retKey(), d.code(), d.retName(), f.returnWhere()), f.params(Actor.of(jwt)),
                (rs, n) -> new SummaryRow(rs.getString("k"), rs.getString("code"), rs.getString("name"), rs.getLong("inv"),
                        rs.getLong("ret"), rs.getBigDecimal("qty"), rs.getBigDecimal("subtotal"), rs.getBigDecimal("discount"),
                        rs.getBigDecimal("revenue"), rs.getBigDecimal("rv"), rs.getBigDecimal("fee"), rs.getBigDecimal("cogs")));
    }
}
