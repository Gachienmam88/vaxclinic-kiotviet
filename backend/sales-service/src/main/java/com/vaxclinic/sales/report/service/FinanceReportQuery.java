package com.vaxclinic.sales.report.service;

import com.vaxclinic.sales.report.dto.ReportFilter;
import com.vaxclinic.sales.common.Actor;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.List;

/**
 * Báo cáo kết quả hoạt động kinh doanh theo tháng (giờ Việt Nam). Màn hình cộng các tháng thành quý / cả kỳ.
 * sales (1) = tiền hàng hóa đơn; invoiceDiscount (2.1); returnValue (2.2) = tiền hàng trả − giảm giá phiếu trả;
 * cogs (4) = giá vốn bán − giá vốn hàng trả (khớp sổ S2a); paymentDiscount = chiết khấu thanh toán (sổ công nợ CKTT, toàn cửa hàng);
 * salary = phiếu chi hạch toán có loại chứa "lương"; otherExpense (9) = phiếu chi hạch toán còn lại (trừ trả NCC);
 * returnFee (8) = phí trả hàng; otherIncome (8) = phiếu thu tay có hạch toán. Xuất hủy lấy từ product-service.
 * deliveryFee = Phí trả ĐTGH: phí giao hàng cửa hàng chịu, ghi vào sổ công nợ đối tác giao hàng (FEE) khi vận đơn
 * giao thành công / chuyển hoàn (phiếu đối soát chỉ là thanh toán, không hạch toán lần 2).
 */
@Component
public class FinanceReportQuery {

    public record MonthRow(String month, BigDecimal sales, BigDecimal invoiceDiscount, BigDecimal returnValue, BigDecimal cogs,
                           BigDecimal returnFee, BigDecimal paymentDiscount, BigDecimal salary, BigDecimal otherExpense,
                           BigDecimal otherIncome, BigDecimal deliveryFee) {
    }

    private static final String M = "to_char(%s at time zone " + ReportFilter.TZ + ", 'YYYY-MM')";
    private static final String EXPENSE = "v.voucher_type = 'PAYMENT' and v.status = 'PAID' and v.accounting"
            + " and coalesce(v.partner_type, '') <> 'SUPPLIER' and coalesce(v.source_type, '') not in ('RETURN', 'PURCHASE')";

    private final NamedParameterJdbcTemplate jdbc;

    public FinanceReportQuery(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<MonthRow> finance(ReportFilter f, Actor actor) {
        String voucherScope = " and v.occurred_at >= :from and v.occurred_at < :to and v.branch_id in (:branches)";
        return jdbc.query("""
                with x as (
                  select %s m, i.subtotal s, i.discount d, 0 rv, (select coalesce(sum(round(l.quantity * l.cost)), 0)
                    from invoice_lines l where l.invoice_id = i.id) cogs, 0 fee, 0 pd, 0 sal, 0 oe, 0 oi, 0 df
                  from invoices i where %s
                  union all
                  select %s, 0, 0, r.subtotal - r.discount, -(select coalesce(sum(round(rl.quantity * coalesce(il.cost, rl.cost, 0))), 0)
                    from sales_return_lines rl left join invoice_lines il on il.id = rl.invoice_line_id where rl.return_id = r.id), r.fee, 0, 0, 0, 0, 0
                  from sales_returns r left join invoices i on i.id = r.invoice_id where %s
                  union all
                  select %s, 0, 0, 0, 0, 0, -d.amount, 0, 0, 0, 0 from customer_debt_ledger d
                  where d.doc_type = 'DISCOUNT' and d.occurred_at >= :from and d.occurred_at < :to
                  union all
                  select %s, 0, 0, 0, 0, 0, 0, case when v.category ilike '%%lương%%' then v.amount else 0 end,
                    case when v.category ilike '%%lương%%' then 0 else v.amount end, 0, 0
                  from cash_vouchers v where %s%s
                  union all
                  select %s, 0, 0, 0, 0, 0, 0, 0, 0, v.amount, 0 from cash_vouchers v
                  where v.voucher_type = 'RECEIPT' and v.status = 'PAID' and v.accounting%s
                  union all
                  select %s, 0, 0, 0, 0, 0, 0, 0, 0, 0, -l.amount from delivery_partner_ledger l
                  where l.doc_type = 'FEE' and l.occurred_at >= :from and l.occurred_at < :to and l.branch_id in (:branches)
                )
                select m, sum(s) s, sum(d) d, sum(rv) rv, sum(cogs) cogs, sum(fee) fee, sum(pd) pd, sum(sal) sal,
                  sum(oe) oe, sum(oi) oi, sum(df) df from x group by m order by m""".formatted(
                M.formatted("i.sold_at"), f.invoiceWhere(), M.formatted("r.returned_at"), f.returnWhere(),
                M.formatted("d.occurred_at"), M.formatted("v.occurred_at"), EXPENSE, voucherScope,
                M.formatted("v.occurred_at"), voucherScope, M.formatted("l.occurred_at")), f.params(actor),
                (rs, n) -> new MonthRow(rs.getString("m"), rs.getBigDecimal("s"), rs.getBigDecimal("d"), rs.getBigDecimal("rv"),
                        rs.getBigDecimal("cogs"), rs.getBigDecimal("fee"), rs.getBigDecimal("pd"), rs.getBigDecimal("sal"),
                        rs.getBigDecimal("oe"), rs.getBigDecimal("oi"), rs.getBigDecimal("df")));
    }
}
