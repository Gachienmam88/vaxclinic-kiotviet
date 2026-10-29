package com.vaxclinic.sales.delivery;

import com.vaxclinic.common.address.AdminUnitCodes;
import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.delivery.DeliveryPartnerDtos.LedgerRow;
import com.vaxclinic.sales.delivery.DeliveryPartnerDtos.PartnerListResponse;
import com.vaxclinic.sales.delivery.DeliveryPartnerDtos.PartnerRequest;
import com.vaxclinic.sales.delivery.DeliveryPartnerDtos.PartnerRow;
import com.vaxclinic.sales.delivery.DeliveryPartnerDtos.ReconcileRow;
import com.vaxclinic.sales.delivery.DeliveryPartnerDtos.SettlementRow;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Đối tác giao hàng: danh sách (bộ lọc + dòng tổng), sổ công nợ, lịch sử thanh toán, vận đơn chờ đối soát;
 * thêm / sửa / xóa dòng delivery_partners (kiểm tra nghiệp vụ ở {@link DeliveryPartnerService}).
 */
@Repository
public class DeliveryPartnerRepository {

    /** Tổng theo vận đơn của đối tác: đơn chưa hủy; thu hộ chỉ tính đơn không chuyển hoàn. */
    private static final String STATS = """
            (select count(*) from shipments s where s.partner_id = p.id and s.status <> 'CANCELLED') cnt,
            (select coalesce(sum(s.shipping_fee), 0) from shipments s where s.partner_id = p.id and s.status <> 'CANCELLED') fee,
            (select coalesce(sum(s.cod_amount), 0) from shipments s where s.partner_id = p.id
                and s.status not in ('CANCELLED', 'RETURNING', 'RETURNED')) cod,
            (select g.name from delivery_partner_groups g where g.id = p.group_id) group_name""";

    private static final RowMapper<PartnerRow> ROW = (rs, n) -> new PartnerRow(rs.getObject("id", UUID.class),
            rs.getString("code"), rs.getString("name"), rs.getString("phone"), rs.getString("email"), rs.getString("address"),
            rs.getString("note"), rs.getString("partner_type"), rs.getBoolean("active"), rs.getLong("cnt"),
            rs.getBigDecimal("fee"), rs.getBigDecimal("cod"), rs.getBigDecimal("debt"), rs.getTimestamp("created_at").toInstant(),
            rs.getString("province"), rs.getString("ward"), rs.getString("province_code"), rs.getString("ward_code"),
            rs.getString("partner_kind"), rs.getObject("group_id", UUID.class), rs.getString("group_name"));

    private final NamedParameterJdbcTemplate jdbc;

    public DeliveryPartnerRepository(NamedParameterJdbcTemplate jdbc) {
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

    public Long nextCodeNumber() {
        return jdbc.getJdbcTemplate().queryForObject("select nextval('delivery_partner_code_seq')", Long.class);
    }

    /** Ném DuplicateKeyException khi trùng mã. */
    public void insert(UUID id, String code, PartnerRequest r, String type, UUID createdBy) {
        jdbc.getJdbcTemplate().update("""
                insert into delivery_partners(id, code, name, phone, email, address, note, partner_type, active, created_by,
                    province, ward, province_code, ward_code, partner_kind, group_id)
                values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""", id, code, r.name().trim(), Actor.blankToNull(r.phone()),
                Actor.blankToNull(r.email()), Actor.blankToNull(r.address()), Actor.blankToNull(r.note()), type,
                r.active() == null || r.active(), createdBy, Actor.blankToNull(r.province()), Actor.blankToNull(r.ward()),
                AdminUnitCodes.clean(r.provinceCode()), AdminUnitCodes.clean(r.wardCode()), kind(r), r.groupId());
    }

    /** Mã hiện tại của đối tác (null = không có). */
    public String codeOf(UUID id) {
        return jdbc.getJdbcTemplate().query("select code from delivery_partners where id = ?",
                rs -> rs.next() ? rs.getString(1) : null, id);
    }

    /** Ném DuplicateKeyException khi trùng mã. */
    public void update(UUID id, String code, PartnerRequest r, String type) {
        jdbc.getJdbcTemplate().update("""
                update delivery_partners set code = ?, name = ?, phone = ?, email = ?, address = ?, note = ?, partner_type = ?,
                    active = ?, province = ?, ward = ?, province_code = ?, ward_code = ?, partner_kind = ?, group_id = ?
                where id = ?""", code, r.name().trim(),
                Actor.blankToNull(r.phone()), Actor.blankToNull(r.email()), Actor.blankToNull(r.address()),
                Actor.blankToNull(r.note()), type, r.active() == null || r.active(), Actor.blankToNull(r.province()),
                Actor.blankToNull(r.ward()), AdminUnitCodes.clean(r.provinceCode()), AdminUnitCodes.clean(r.wardCode()), kind(r),
                r.groupId(), id);
    }

    private static String kind(PartnerRequest r) {
        return r.partnerKind() == null ? "PERSONAL" : r.partnerKind();
    }

    /** Khóa dòng đối tác trước khi xóa (code, debt; rỗng = không có). */
    public List<Map<String, Object>> lockForDelete(UUID id) {
        return jdbc.getJdbcTemplate().queryForList("select code, debt from delivery_partners where id = ? for update", id);
    }

    /** Số vận đơn + dòng sổ công nợ của đối tác. */
    public Integer countUsage(UUID id) {
        return jdbc.getJdbcTemplate().queryForObject("select (select count(*) from shipments where partner_id = ?)"
                + " + (select count(*) from delivery_partner_ledger where partner_id = ?)", Integer.class, id, id);
    }

    public void delete(UUID id) {
        jdbc.getJdbcTemplate().update("delete from delivery_partners where id = ?", id);
    }

    /** Tên + điện thoại đối tác cho phiếu Sổ quỹ (rỗng = không có). */
    public List<Map<String, Object>> contact(UUID id) {
        return jdbc.queryForList("select name, phone from delivery_partners where id = :id", new MapSqlParameterSource("id", id));
    }

    /** Trạng thái hoạt động của đối tác (null = không có). */
    public Boolean activeOf(UUID id) {
        return jdbc.getJdbcTemplate().query("select active from delivery_partners where id = ?",
                rs -> rs.next() ? rs.getBoolean(1) : null, id);
    }

    static BigDecimal nz(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }
}
