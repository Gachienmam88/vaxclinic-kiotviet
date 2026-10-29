package com.vaxclinic.sales.accounting;

import com.vaxclinic.common.settings.ShopSettings;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Truy vấn Sổ doanh thu (S1a/S2a/S2b-HKD): doanh thu theo ngày (giờ Việt Nam) × mặt hàng × mã thuế, và chi phí khác.
 * Giảm giá cả hóa đơn phân bổ vào từng dòng theo tỷ lệ tiền hàng. Chỉ truy cập DB.
 */
@Repository
public class RevenueBookRepository {

    /**
     * Theo ngày × mặt hàng × mã thuế (mặt hàng → nhóm hàng → ngành nghề, tính thuế theo ngành). cogs: giá vốn (đã trừ hàng trả lại).
     * returns = giá trị hàng trả (tiền hàng trả − giảm giá phiếu trả, phân bổ theo dòng); returnFee = phí trả hàng khách chịu
     * (phân bổ theo dòng) — KHÔNG nằm trong doanh thu thuần (sales − returns), là dòng "Thu khác / Phí trả hàng" riêng.
     */
    public record DailyRevenue(LocalDate date, UUID productId, String taxCode, BigDecimal sales, BigDecimal returns, BigDecimal cogs,
                               int invoiceCount, BigDecimal returnFee) {
    }

    /** Chi phí khác: phiếu chi hạch toán kết quả kinh doanh, KHÔNG gồm trả nhà cung cấp (đã nằm trong giá vốn). */
    public record DailyExpense(LocalDate date, String category, BigDecimal amount) {
    }

    private final NamedParameterJdbcTemplate jdbc;

    public RevenueBookRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Hóa đơn hoàn thành − hàng khách trả; phí trả hàng tách cột returnFee (KiotViet). branchIds rỗng = mọi chi nhánh. */
    public List<DailyRevenue> daily(LocalDate from, LocalDate to, List<UUID> branchIds) {
        return jdbc.query("""
                with inv as (
                  select i.id, (i.sold_at at time zone 'Asia/Ho_Chi_Minh')::date d, i.total, i.subtotal
                  from invoices i
                  where i.status = 'COMPLETED' and i.sold_at >= :from and i.sold_at < :to
                    and (:allBranches or i.branch_id in (:branches))
                ), sale as (
                  select inv.d, l.product_id, coalesce(l.tax_code, '') tax_code, count(distinct inv.id) n,
                    sum(case when inv.subtotal = 0 then 0
                             else round(inv.total * l.quantity * (l.unit_price - l.discount) / inv.subtotal) end) amount,
                    sum(round(l.quantity * l.cost)) cogs
                  from inv join invoice_lines l on l.invoice_id = inv.id group by 1, 2, 3
                ), ret as (
                  select r.id, (r.returned_at at time zone 'Asia/Ho_Chi_Minh')::date d, r.subtotal, r.discount, r.fee
                  from sales_returns r
                  where r.status = 'COMPLETED' and r.returned_at >= :from and r.returned_at < :to
                    and (:allBranches or r.branch_id in (:branches))
                ), back as (
                  select ret.d, rl.product_id, coalesce(il.tax_code, '') tax_code,
                    sum(case when ret.subtotal = 0 then 0
                             else round((ret.subtotal - ret.discount) * rl.quantity * rl.unit_price / ret.subtotal) end) amount,
                    sum(case when ret.subtotal = 0 then 0 else round(ret.fee * rl.quantity * rl.unit_price / ret.subtotal) end) fee,
                    sum(round(rl.quantity * coalesce(il.cost, rl.cost, 0))) cogs
                  from ret join sales_return_lines rl on rl.return_id = ret.id
                  left join invoice_lines il on il.id = rl.invoice_line_id group by 1, 2, 3
                )
                select coalesce(s.d, b.d) d, coalesce(s.product_id, b.product_id) product_id, coalesce(s.tax_code, b.tax_code) tax_code,
                  coalesce(s.amount, 0) sales,
                  coalesce(b.amount, 0) returns, coalesce(s.cogs, 0) - coalesce(b.cogs, 0) cogs, coalesce(s.n, 0) n,
                  coalesce(b.fee, 0) fee
                from sale s full join back b on b.d = s.d and b.product_id = s.product_id and b.tax_code = s.tax_code
                order by 1, 2, 3""", params(from, to, branchIds),
                (rs, i) -> new DailyRevenue(rs.getObject("d", LocalDate.class), rs.getObject("product_id", UUID.class), rs.getString("tax_code"),
                        rs.getBigDecimal("sales"), rs.getBigDecimal("returns"), rs.getBigDecimal("cogs"), rs.getInt("n"),
                        rs.getBigDecimal("fee")));
    }

    public List<DailyExpense> expenses(LocalDate from, LocalDate to, List<UUID> branchIds) {
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
