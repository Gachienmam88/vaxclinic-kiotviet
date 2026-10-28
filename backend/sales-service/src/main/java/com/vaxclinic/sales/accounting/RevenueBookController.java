package com.vaxclinic.sales.accounting;

import com.vaxclinic.common.settings.ShopSettings;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Số liệu cho Sổ doanh thu bán hàng hóa, dịch vụ (S1a/S2a/S2b-HKD) và tờ khai thuế hộ kinh doanh.
 * Doanh thu theo NGÀY (giờ Việt Nam) và theo MÃ THUẾ của dòng hàng: hóa đơn hoàn thành − hàng khách trả.
 * Giảm giá cả hóa đơn được phân bổ vào từng dòng theo tỷ lệ tiền hàng. Phí trả hàng khách chịu tính vào doanh thu.
 */
@RestController
public class RevenueBookController {

    /** cogs: giá vốn hàng bán (đã trừ hàng trả lại). */
    public record DailyRevenue(LocalDate date, String taxCode, BigDecimal sales, BigDecimal returns, BigDecimal cogs,
                               int invoiceCount) {
    }

    /** Chi phí khác: phiếu chi hạch toán kết quả kinh doanh, KHÔNG gồm trả nhà cung cấp (đã nằm trong giá vốn). */
    public record DailyExpense(LocalDate date, String category, BigDecimal amount) {
    }

    private final NamedParameterJdbcTemplate jdbc;

    public RevenueBookController(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping("/api/accounting/revenue/daily")
    @PreAuthorize("hasAuthority('report.view') or hasAuthority('cashbook.manage')")
    public List<DailyRevenue> daily(@RequestParam LocalDate from, @RequestParam LocalDate to,
                                    @RequestParam(required = false) List<UUID> branchIds) {
        var p = new MapSqlParameterSource()
                .addValue("from", Timestamp.from(from.atStartOfDay(ShopSettings.ZONE).toInstant()))
                .addValue("to", Timestamp.from(to.plusDays(1).atStartOfDay(ShopSettings.ZONE).toInstant()))
                // Danh sách rỗng → "in ()" sai cú pháp: thay bằng 1 id giả, cờ allBranches bỏ qua điều kiện
                .addValue("branches", branchIds == null || branchIds.isEmpty() ? List.of(new UUID(0, 0)) : branchIds)
                .addValue("allBranches", branchIds == null || branchIds.isEmpty());
        return jdbc.query("""
                with inv as (
                  select i.id, (i.sold_at at time zone 'Asia/Ho_Chi_Minh')::date d, i.total, i.subtotal
                  from invoices i
                  where i.status = 'COMPLETED' and i.sold_at >= :from and i.sold_at < :to
                    and (:allBranches or i.branch_id in (:branches))
                ), sale as (
                  select inv.d, coalesce(l.tax_code, '') tax_code, count(distinct inv.id) n,
                    sum(case when inv.subtotal = 0 then 0
                             else round(inv.total * l.quantity * (l.unit_price - l.discount) / inv.subtotal) end) amount,
                    sum(round(l.quantity * l.cost)) cogs
                  from inv join invoice_lines l on l.invoice_id = inv.id group by 1, 2
                ), ret as (
                  select r.id, (r.returned_at at time zone 'Asia/Ho_Chi_Minh')::date d, r.total, r.subtotal
                  from sales_returns r
                  where r.status = 'COMPLETED' and r.returned_at >= :from and r.returned_at < :to
                    and (:allBranches or r.branch_id in (:branches))
                ), back as (
                  select ret.d, coalesce(il.tax_code, '') tax_code,
                    sum(case when ret.subtotal = 0 then 0
                             else round(ret.total * rl.quantity * rl.unit_price / ret.subtotal) end) amount,
                    sum(round(rl.quantity * coalesce(il.cost, 0))) cogs
                  from ret join sales_return_lines rl on rl.return_id = ret.id
                  left join invoice_lines il on il.id = rl.invoice_line_id group by 1, 2
                )
                select coalesce(s.d, b.d) d, coalesce(s.tax_code, b.tax_code) tax_code, coalesce(s.amount, 0) sales,
                  coalesce(b.amount, 0) returns, coalesce(s.cogs, 0) - coalesce(b.cogs, 0) cogs, coalesce(s.n, 0) n
                from sale s full join back b on b.d = s.d and b.tax_code = s.tax_code
                order by 1, 2""", params(from, to, branchIds),
                (rs, i) -> new DailyRevenue(rs.getObject("d", LocalDate.class), rs.getString("tax_code"),
                        rs.getBigDecimal("sales"), rs.getBigDecimal("returns"), rs.getBigDecimal("cogs"), rs.getInt("n")));
    }

    @GetMapping("/api/accounting/revenue/expenses")
    @PreAuthorize("hasAuthority('report.view') or hasAuthority('cashbook.manage')")
    public List<DailyExpense> expenses(@RequestParam LocalDate from, @RequestParam LocalDate to,
                                       @RequestParam(required = false) List<UUID> branchIds) {
        return jdbc.query("""
                select (occurred_at at time zone 'Asia/Ho_Chi_Minh')::date d, category, sum(amount) amount
                from cash_vouchers
                where voucher_type = 'PAYMENT' and status = 'PAID' and accounting
                  and coalesce(partner_type, '') <> 'SUPPLIER' and coalesce(source_type, '') not in ('RETURN', 'PURCHASE')
                  and occurred_at >= :from and occurred_at < :to and (:allBranches or branch_id in (:branches))
                group by 1, 2 order by 1, 2""", params(from, to, branchIds),
                (rs, i) -> new DailyExpense(rs.getObject("d", LocalDate.class), rs.getString("category"), rs.getBigDecimal("amount")));
    }

    private static MapSqlParameterSource params(LocalDate from, LocalDate to, List<UUID> branchIds) {
        boolean all = branchIds == null || branchIds.isEmpty();
        return new MapSqlParameterSource()
                .addValue("from", Timestamp.from(from.atStartOfDay(ShopSettings.ZONE).toInstant()))
                .addValue("to", Timestamp.from(to.plusDays(1).atStartOfDay(ShopSettings.ZONE).toInstant()))
                // Danh sách rỗng → "in ()" sai cú pháp: thay bằng 1 id giả, cờ allBranches bỏ qua điều kiện
                .addValue("branches", all ? List.of(new UUID(0, 0)) : branchIds)
                .addValue("allBranches", all);
    }
}
