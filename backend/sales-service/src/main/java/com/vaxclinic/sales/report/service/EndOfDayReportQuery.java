package com.vaxclinic.sales.report.service;

import com.vaxclinic.sales.report.dto.ReportFilter;
import com.vaxclinic.sales.common.Actor;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Báo cáo cuối ngày (KiotViet): Bán hàng = từng hóa đơn / phiếu trả trong kỳ kèm tiền thực thu trong kỳ;
 * Thu chi = các phiếu thu / chi của Sổ quỹ trong kỳ. Màn hình tự nhóm theo phương thức thanh toán / tài khoản.
 */
@Component
public class EndOfDayReportQuery {

    /**
     * kind INVOICE / RETURN. Phiếu trả mang số âm (giảm doanh thu). paid = thực thu trong kỳ (phiếu thu phân bổ vào hóa đơn,
     * phiếu chi trả khách), debt = phần ghi nợ (= revenue + fee − paid với phiếu trả: revenue âm, fee dương).
     * method: phương thức thanh toán của chứng từ (null = chưa thanh toán); bankLabel: "Ngân hàng - số TK - chủ TK".
     */
    public record DocRow(String kind, UUID id, String code, Instant time, String customerName, String sellerName,
                         BigDecimal qty, BigDecimal subtotal, BigDecimal discount, BigDecimal revenue, BigDecimal fee,
                         BigDecimal paid, BigDecimal debt, String method, String bankLabel) {
    }

    public record VoucherRow(UUID id, String code, Instant time, String voucherType, String fund, String bankLabel,
                             String category, String partnerName, String collectorName, String createdByName,
                             BigDecimal amount, String sourceType) {
    }

    private static final String BANK_LABEL =
            "(select b.bank_name || ' - ' || b.account_no || ' - ' || b.account_name from bank_accounts b where b.id = %s)";

    private final NamedParameterJdbcTemplate jdbc;

    public EndOfDayReportQuery(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<DocRow> sales(ReportFilter f, Actor actor) {
        var p = f.params(actor);
        var out = new ArrayList<DocRow>();
        out.addAll(jdbc.query("""
                select i.id, i.code, i.sold_at t, i.customer_name, coalesce(i.seller_name, i.created_by_name) seller,
                  (select coalesce(sum(l.quantity), 0) from invoice_lines l where l.invoice_id = i.id) qty,
                  i.subtotal, i.discount, i.total, i.payment_method,
                  (select coalesce(sum(a.amount), 0) from voucher_allocations a join cash_vouchers v on v.id = a.voucher_id
                    where a.invoice_id = i.id and v.status = 'PAID' and v.occurred_at >= :from and v.occurred_at < :to) paid,
                  %s bank
                from invoices i where %s order by i.sold_at""".formatted(BANK_LABEL.formatted("""
                (select v.bank_account_id from voucher_allocations a join cash_vouchers v on v.id = a.voucher_id
                  where a.invoice_id = i.id and v.status = 'PAID' and v.bank_account_id is not null order by v.occurred_at limit 1)"""),
                f.invoiceWhere()), p, (rs, n) -> {
            BigDecimal total = rs.getBigDecimal("total"), paid = rs.getBigDecimal("paid");
            return new DocRow("INVOICE", rs.getObject("id", UUID.class), rs.getString("code"), rs.getTimestamp("t").toInstant(),
                    rs.getString("customer_name"), rs.getString("seller"), rs.getBigDecimal("qty"), rs.getBigDecimal("subtotal"),
                    rs.getBigDecimal("discount"), total, BigDecimal.ZERO, paid, total.subtract(paid),
                    paid.signum() > 0 ? rs.getString("payment_method") : null, rs.getString("bank"));
        }));
        out.addAll(jdbc.query("""
                select r.id, r.code, r.returned_at t, r.customer_name, coalesce(i.seller_name, i.created_by_name, r.created_by_name) seller,
                  (select coalesce(sum(rl.quantity), 0) from sales_return_lines rl where rl.return_id = r.id) qty,
                  r.subtotal, r.discount, r.fee, r.total, r.payment_method,
                  (select coalesce(sum(v.amount), 0) from cash_vouchers v where v.source_type = 'RETURN' and v.source_id = r.id
                    and v.status = 'PAID' and v.occurred_at >= :from and v.occurred_at < :to) refunded,
                  %s bank
                from sales_returns r left join invoices i on i.id = r.invoice_id where %s order by r.returned_at""".formatted(
                BANK_LABEL.formatted("(select v.bank_account_id from cash_vouchers v where v.source_type = 'RETURN' and v.source_id = r.id limit 1)"),
                f.returnWhere()), p, (rs, n) -> {
            BigDecimal refunded = rs.getBigDecimal("refunded"), total = rs.getBigDecimal("total");
            return new DocRow("RETURN", rs.getObject("id", UUID.class), rs.getString("code"), rs.getTimestamp("t").toInstant(),
                    rs.getString("customer_name"), rs.getString("seller"), rs.getBigDecimal("qty").negate(),
                    rs.getBigDecimal("subtotal").negate(), rs.getBigDecimal("discount").negate(),
                    rs.getBigDecimal("subtotal").subtract(rs.getBigDecimal("discount")).negate(), rs.getBigDecimal("fee"),
                    refunded.negate(), refunded.subtract(total), refunded.signum() > 0 ? rs.getString("payment_method") : null,
                    rs.getString("bank"));
        }));
        return out;
    }

    /** Phiếu thu/chi đã thanh toán trong kỳ. funds: CASH/BANK/EWALLET; partnerId: khách hàng; collectorId: nhân viên thu/chi. */
    public List<VoucherRow> cashflow(ReportFilter f, List<String> funds, Actor actor) {
        var p = f.params(actor).addValue("funds", funds == null || funds.isEmpty() ? List.of("-") : funds);
        var w = new StringBuilder("v.status = 'PAID' and v.occurred_at >= :from and v.occurred_at < :to and v.branch_id in (:branches)");
        if (f.customerId() != null) w.append(" and v.partner_id = :customerId");
        if (f.sellerId() != null) w.append(" and v.collector_id = :sellerId");
        if (f.createdBy() != null) w.append(" and v.created_by = :createdBy");
        if (funds != null && !funds.isEmpty()) w.append(" and v.fund in (:funds)");
        return jdbc.query("""
                select v.*, %s bank from cash_vouchers v where %s order by v.occurred_at""".formatted(
                BANK_LABEL.formatted("v.bank_account_id"), w), p, (rs, n) -> new VoucherRow(rs.getObject("id", UUID.class),
                rs.getString("code"), rs.getTimestamp("occurred_at").toInstant(), rs.getString("voucher_type"), rs.getString("fund"),
                rs.getString("bank"), rs.getString("category"), rs.getString("partner_name"), rs.getString("collector_name"),
                rs.getString("created_by_name"), rs.getBigDecimal("amount"), rs.getString("source_type")));
    }
}
