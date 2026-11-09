package com.vaxclinic.sales.cashbook.service;

import com.vaxclinic.sales.cashbook.dto.CashbookDtos;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Sổ quỹ: danh sách phiếu + 4 số tổng (Quỹ đầu kỳ, Tổng thu, Tổng chi, Tồn quỹ) theo quỹ và khoảng thời gian.
 * Quỹ đầu kỳ = Σ(thu − chi) các phiếu đã thanh toán TRƯỚC thời điểm bắt đầu; Tồn quỹ = đầu kỳ + thu − chi.
 */
@Component
public class CashbookQuery {

    public record Filter(String fund, Instant from, Instant to, List<String> voucherTypes, String category,
                         List<String> statuses, Boolean accounting, UUID createdBy, UUID collectorId,
                         String partnerType, String partner, String q, UUID branchId, int page, int size) {
    }

    public record Item(UUID id, String code, Instant occurredAt, String voucherType, String category, String fund,
                       String partnerName, String partnerPhone, BigDecimal amount, String status, boolean accounting,
                       String sourceType) {
    }

    public record Summary(BigDecimal opening, BigDecimal receipts, BigDecimal payments, BigDecimal closing) {
    }

    public record Page(List<Item> items, long total, int page, int size, Summary summary) {
    }

    private final NamedParameterJdbcTemplate jdbc;

    public CashbookQuery(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Page search(Filter f) {
        var p = new MapSqlParameterSource();
        String fundSql = f.fund() == null || "ALL".equals(f.fund()) ? "" : " and v.fund = :fund";
        p.addValue("fund", f.fund());
        String branchSql = f.branchId() == null ? "" : " and v.branch_id = :branchId";
        p.addValue("branchId", f.branchId());

        var w = new StringBuilder(" from cash_vouchers v where 1=1").append(fundSql).append(branchSql);
        if (f.from() != null) { w.append(" and v.occurred_at >= :from"); p.addValue("from", Timestamp.from(f.from())); }
        if (f.to() != null) { w.append(" and v.occurred_at < :to"); p.addValue("to", Timestamp.from(f.to())); }
        if (f.voucherTypes() != null && !f.voucherTypes().isEmpty()) {
            w.append(" and v.voucher_type in (:types)"); p.addValue("types", f.voucherTypes());
        }
        if (f.category() != null && !f.category().isBlank()) { w.append(" and v.category = :category"); p.addValue("category", f.category()); }
        if (f.statuses() != null && !f.statuses().isEmpty()) { w.append(" and v.status in (:statuses)"); p.addValue("statuses", f.statuses()); }
        if (f.accounting() != null) { w.append(" and v.accounting = :accounting"); p.addValue("accounting", f.accounting()); }
        if (f.createdBy() != null) { w.append(" and v.created_by = :createdBy"); p.addValue("createdBy", f.createdBy()); }
        if (f.collectorId() != null) { w.append(" and v.collector_id = :collectorId"); p.addValue("collectorId", f.collectorId()); }
        if (f.partnerType() != null && !f.partnerType().isBlank()) { w.append(" and v.partner_type = :ptype"); p.addValue("ptype", f.partnerType()); }
        if (f.partner() != null && !f.partner().isBlank()) {
            w.append(" and (v.partner_name ilike :partner or v.partner_phone ilike :partner)");
            p.addValue("partner", "%" + f.partner().trim() + "%");
        }
        if (f.q() != null && !f.q().isBlank()) { w.append(" and v.code ilike :q"); p.addValue("q", "%" + f.q().trim() + "%"); }

        String signed = "case when v.voucher_type = 'RECEIPT' then v.amount else -v.amount end";
        BigDecimal opening = f.from() == null ? BigDecimal.ZERO : jdbc.queryForObject(
                "select coalesce(sum(" + signed + "),0) from cash_vouchers v where v.status = 'PAID' and v.occurred_at < :from"
                        + fundSql + branchSql, p, BigDecimal.class);
        var agg = jdbc.queryForMap("select count(*) cnt,"
                + " coalesce(sum(case when v.status='PAID' and v.voucher_type='RECEIPT' then v.amount end),0) rec,"
                + " coalesce(sum(case when v.status='PAID' and v.voucher_type='PAYMENT' then v.amount end),0) pay" + w, p);
        BigDecimal rec = (BigDecimal) agg.get("rec");
        BigDecimal pay = (BigDecimal) agg.get("pay");

        p.addValue("limit", f.size()).addValue("offset", (long) f.page() * f.size());
        var items = jdbc.query("select v.*" + w + " order by v.occurred_at desc limit :limit offset :offset", p,
                (rs, n) -> new Item(rs.getObject("id", UUID.class), rs.getString("code"),
                        rs.getTimestamp("occurred_at").toInstant(), rs.getString("voucher_type"), rs.getString("category"),
                        rs.getString("fund"), rs.getString("partner_name"), rs.getString("partner_phone"),
                        rs.getBigDecimal("amount"), rs.getString("status"), rs.getBoolean("accounting"),
                        rs.getString("source_type")));
        return new Page(items, ((Number) agg.get("cnt")).longValue(), f.page(), f.size(),
                new Summary(opening, rec, pay, opening.add(rec).subtract(pay)));
    }

    public List<String> categories() {
        return jdbc.getJdbcTemplate().queryForList("select distinct category from cash_vouchers order by category", String.class);
    }

    /** Các hóa đơn được phân bổ từ phiếu (theo thời gian bán). */
    public List<CashbookDtos.Allocated> allocations(UUID voucherId) {
        return jdbc.query("""
                select i.id, i.code, i.sold_at, i.total, a.amount from voucher_allocations a
                join invoices i on i.id = a.invoice_id where a.voucher_id = :id order by i.sold_at""",
                new MapSqlParameterSource("id", voucherId), (rs, n) -> new CashbookDtos.Allocated(rs.getObject("id", UUID.class),
                        rs.getString("code"), rs.getTimestamp("sold_at").toInstant(), rs.getBigDecimal("total"),
                        rs.getBigDecimal("amount")));
    }
}
