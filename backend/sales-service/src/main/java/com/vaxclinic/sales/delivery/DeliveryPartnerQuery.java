package com.vaxclinic.sales.delivery;

import com.vaxclinic.sales.delivery.DeliveryPartnerDtos.LedgerRow;
import com.vaxclinic.sales.delivery.DeliveryPartnerDtos.PartnerListResponse;
import com.vaxclinic.sales.delivery.DeliveryPartnerDtos.PartnerRow;
import com.vaxclinic.sales.delivery.DeliveryPartnerDtos.ReconcileRow;
import com.vaxclinic.sales.delivery.DeliveryPartnerDtos.SettlementRow;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/** Danh sách đối tác giao hàng (bộ lọc + dòng tổng), sổ công nợ, lịch sử thanh toán, vận đơn chờ đối soát. */
@Component
public class DeliveryPartnerQuery {

    /** Tổng theo vận đơn của đối tác: đơn chưa hủy; thu hộ chỉ tính đơn không chuyển hoàn. */
    private static final String STATS = """
            (select count(*) from shipments s where s.partner_id = p.id and s.status <> 'CANCELLED') cnt,
            (select coalesce(sum(s.shipping_fee), 0) from shipments s where s.partner_id = p.id and s.status <> 'CANCELLED') fee,
            (select coalesce(sum(s.cod_amount), 0) from shipments s where s.partner_id = p.id
                and s.status not in ('CANCELLED', 'RETURNING', 'RETURNED')) cod""";

    private static final RowMapper<PartnerRow> ROW = (rs, n) -> new PartnerRow(rs.getObject("id", UUID.class),
            rs.getString("code"), rs.getString("name"), rs.getString("phone"), rs.getString("email"), rs.getString("address"),
            rs.getString("note"), rs.getString("partner_type"), rs.getBoolean("active"), rs.getLong("cnt"),
            rs.getBigDecimal("fee"), rs.getBigDecimal("cod"), rs.getBigDecimal("debt"), rs.getTimestamp("created_at").toInstant(),
            rs.getString("province"), rs.getString("ward"), rs.getString("province_code"), rs.getString("ward_code"));

    private final NamedParameterJdbcTemplate jdbc;

    public DeliveryPartnerQuery(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** active: null = tất cả; debt: OWING = đối tác còn nợ cửa hàng, PAYABLE = cửa hàng còn nợ đối tác. */
    public PartnerListResponse list(String q, Boolean active, String debt, int page, int size) {
        var p = new MapSqlParameterSource();
        var w = new StringBuilder(" from delivery_partners p where 1=1");
        if (q != null && !q.isBlank()) {
            w.append(" and (p.code ilike :q or p.name ilike :q or p.phone ilike :q)");
            p.addValue("q", "%" + q.trim() + "%");
        }
        if (active != null) {
            w.append(" and p.active = :active");
            p.addValue("active", active);
        }
        if ("OWING".equals(debt)) w.append(" and p.debt > 0");
        if ("PAYABLE".equals(debt)) w.append(" and p.debt < 0");
        var agg = jdbc.queryForMap("select count(*) n, coalesce(sum(x.fee), 0) fee, coalesce(sum(x.cod), 0) cod,"
                + " coalesce(sum(x.debt), 0) debt from (select p.debt, " + STATS + w + ") x", p);
        p.addValue("limit", size).addValue("offset", (long) page * size);
        var items = jdbc.query("select p.*, " + STATS + w + " order by p.created_at desc limit :limit offset :offset", p, ROW);
        return new PartnerListResponse(items, ((Number) agg.get("n")).longValue(), page, size, (BigDecimal) agg.get("fee"),
                (BigDecimal) agg.get("cod"), (BigDecimal) agg.get("debt"));
    }

    public PartnerRow get(UUID id) {
        var rows = jdbc.query("select p.*, " + STATS + " from delivery_partners p where p.id = :id",
                new MapSqlParameterSource("id", id), ROW);
        if (rows.isEmpty()) {
            throw DeliveryPartnerService.notFound();
        }
        return rows.get(0);
    }

    public List<LedgerRow> ledger(UUID id) {
        return jdbc.query("select * from delivery_partner_ledger where partner_id = :id order by occurred_at desc, created_at desc",
                new MapSqlParameterSource("id", id), (rs, n) -> new LedgerRow(rs.getObject("id", UUID.class),
                        rs.getString("doc_type"), rs.getObject("doc_id", UUID.class), rs.getString("doc_code"),
                        rs.getBigDecimal("amount"), rs.getBigDecimal("balance_after"), rs.getString("note"),
                        rs.getTimestamp("occurred_at").toInstant()));
    }

    public List<SettlementRow> settlements(UUID id) {
        return jdbc.query("""
                select d.*, v.code voucher_code from delivery_settlements d left join cash_vouchers v on v.id = d.voucher_id
                where d.partner_id = :id order by d.created_at desc""", new MapSqlParameterSource("id", id),
                (rs, n) -> new SettlementRow(rs.getObject("id", UUID.class), rs.getString("code"), rs.getString("kind"),
                        rs.getObject("branch_id", UUID.class), rs.getBigDecimal("cod_total"), rs.getBigDecimal("fee_total"),
                        rs.getBigDecimal("amount"), rs.getInt("shipment_count"), rs.getString("voucher_code"),
                        rs.getString("status"), rs.getString("note"), rs.getString("created_by_name"),
                        rs.getTimestamp("created_at").toInstant()));
    }

    /** Vận đơn chờ đối soát của đối tác (Giao thành công / Đã chuyển hoàn, chưa gắn phiếu đối soát). */
    public List<ReconcileRow> reconcilable(UUID partnerId, List<UUID> branchIds) {
        return jdbc.query("""
                select s.*, i.code invoice_code from shipments s join invoices i on i.id = s.invoice_id
                where s.partner_id = :id and s.settlement_id is null and s.status in ('DELIVERED', 'RETURNED')
                  and s.branch_id in (:branches) order by s.delivered_at nulls last, s.created_at""",
                new MapSqlParameterSource("id", partnerId).addValue("branches", branchIds.isEmpty() ? List.of(new UUID(0, 0)) : branchIds),
                (rs, n) -> {
                    BigDecimal cod = nz(rs.getBigDecimal("cod_posted"));
                    BigDecimal fee = nz(rs.getBigDecimal("fee_posted"));
                    return new ReconcileRow(rs.getObject("id", UUID.class), rs.getString("code"), rs.getString("invoice_code"),
                            rs.getString("receiver_name"), rs.getString("status"), rs.getObject("branch_id", UUID.class), cod, fee,
                            cod.subtract(fee), rs.getTimestamp("delivered_at") == null ? null : rs.getTimestamp("delivered_at").toInstant());
                });
    }

    static BigDecimal nz(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }
}
