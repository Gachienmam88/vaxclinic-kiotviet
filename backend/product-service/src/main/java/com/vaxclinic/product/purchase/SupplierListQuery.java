package com.vaxclinic.product.purchase;

import com.vaxclinic.common.error.BusinessException;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Danh sách NCC kiểu KiotViet: Nợ cần trả hiện tại + Tổng mua, lọc nhóm / tổng mua (giá trị + thời gian) / nợ / trạng thái.
 * Nợ = Σ sổ công nợ {@link #LEDGER}; Tổng mua = Σ tổng phiếu nhập − Σ tổng phiếu trả hàng nhập (đã hoàn thành).
 */
@Component
public class SupplierListQuery {

    /** Sổ công nợ NCC: mỗi dòng 1 phát sinh, v > 0 tăng nợ. ord: thứ tự trong cùng thời điểm (nhập trước, thanh toán sau). */
    static final String LEDGER = """
            select r.supplier_id sid, r.id doc_id, r.code, r.received_at t, 0 ord, 'PURCHASE' type, r.total v, r.created_at c
            from purchase_receipts r where r.status = 'COMPLETED' and r.supplier_id is not null
            union all
            select r.supplier_id, r.id, r.code, r.returned_at, 1, 'PURCHASE_RETURN', -(r.total - r.refund_amount), r.created_at
            from purchase_returns r where r.status = 'COMPLETED' and r.supplier_id is not null
            union all
            select d.supplier_id, d.id, d.code, d.occurred_at, 2, d.kind,
              case when d.kind = 'ADJUSTMENT' then d.amount else -d.amount end, d.created_at
            from supplier_debt_docs d where d.status = 'ACTIVE'""";

    public record Filter(String q, UUID groupId, Boolean active, BigDecimal buyFrom, BigDecimal buyTo, Instant from,
                         Instant to, BigDecimal debtFrom, BigDecimal debtTo, String docCode, int page, int size) {
    }

    public record SupplierRow(UUID id, String code, String name, String phone, String email, String address,
                              String province, String ward, UUID groupId, String groupName, String note,
                              String companyName, String taxCode, String idNumber, boolean active, UUID branchId,
                              String createdByName, Instant createdAt, BigDecimal debt, BigDecimal totalBuy,
                              String provinceCode, String wardCode) {
    }

    public record SupplierPage(List<SupplierRow> items, long total, int page, int size, BigDecimal sumDebt,
                               BigDecimal sumTotalBuy) {
    }

    private static final RowMapper<SupplierRow> ROW = (rs, n) -> new SupplierRow(rs.getObject("id", UUID.class),
            rs.getString("code"), rs.getString("name"), rs.getString("phone"), rs.getString("email"),
            rs.getString("address"), rs.getString("province"), rs.getString("ward"), rs.getObject("group_id", UUID.class),
            rs.getString("group_name"), rs.getString("note"), rs.getString("company_name"), rs.getString("tax_code"),
            rs.getString("id_number"), rs.getBoolean("active"), rs.getObject("branch_id", UUID.class),
            rs.getString("created_by_name"), rs.getTimestamp("created_at").toInstant(), rs.getBigDecimal("debt"),
            rs.getBigDecimal("total_buy"), rs.getString("province_code"), rs.getString("ward_code"));

    private final NamedParameterJdbcTemplate jdbc;

    public SupplierListQuery(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public SupplierPage search(Filter f) {
        var p = new MapSqlParameterSource();
        StringBuilder buyWhere = new StringBuilder();
        if (f.from() != null) {
            buyWhere.append(" and t >= :from");
            p.addValue("from", Timestamp.from(f.from()));
        }
        if (f.to() != null) {
            buyWhere.append(" and t < :to");
            p.addValue("to", Timestamp.from(f.to()));
        }
        StringBuilder where = new StringBuilder(" where true");
        if (f.q() != null && !f.q().isBlank()) {
            where.append(" and (s.code ilike :q or s.name ilike :q or s.phone like :q or s.tax_code like :q)");
            p.addValue("q", "%" + f.q().trim().replace("%", "\\%").replace("_", "\\_") + "%");
        }
        if (f.docCode() != null && !f.docCode().isBlank()) {
            where.append(" and exists (select 1 from supplier_debt_docs x where x.supplier_id = s.id and upper(x.code) = upper(:docCode))");
            p.addValue("docCode", f.docCode().trim());
        }
        if (f.groupId() != null) {
            where.append(" and s.group_id = :groupId");
            p.addValue("groupId", f.groupId());
        }
        if (f.active() != null) {
            where.append(" and s.active = :active");
            p.addValue("active", f.active());
        }
        range(where, p, "coalesce(b.v, 0)", "buy", f.buyFrom(), f.buyTo());
        range(where, p, "coalesce(d.v, 0)", "debt", f.debtFrom(), f.debtTo());
        String base = base(buyWhere.toString(), where.toString());
        var agg = jdbc.queryForMap("select count(*) n, coalesce(sum(debt), 0) sd, coalesce(sum(total_buy), 0) sb from ("
                + base + ") x", p);
        p.addValue("limit", f.size()).addValue("offset", (long) f.page() * f.size());
        List<SupplierRow> items = jdbc.query(base + " order by s.created_at desc, s.code desc limit :limit offset :offset", p, ROW);
        return new SupplierPage(items, ((Number) agg.get("n")).longValue(), f.page(), f.size(),
                (BigDecimal) agg.get("sd"), (BigDecimal) agg.get("sb"));
    }

    public SupplierRow one(UUID id) {
        var rows = jdbc.query(base("", " where s.id = :id"), new MapSqlParameterSource("id", id), ROW);
        if (rows.isEmpty()) {
            throw BusinessException.notFound("SUPPLIER_NOT_FOUND", "Không tìm thấy nhà cung cấp");
        }
        return rows.get(0);
    }

    /** Nợ cần trả hiện tại của 1 NCC. */
    public BigDecimal debt(UUID supplierId) {
        return jdbc.queryForObject("select coalesce(sum(v), 0) from (" + LEDGER + ") l where l.sid = :id",
                new MapSqlParameterSource("id", supplierId), BigDecimal.class);
    }

    private static String base(String buyWhere, String where) {
        return """
                select s.*, g.name group_name, coalesce(d.v, 0) debt, coalesce(b.v, 0) total_buy
                from suppliers s left join supplier_groups g on g.id = s.group_id
                left join (select sid, sum(v) v from (%s) l group by sid) d on d.sid = s.id
                left join (select sid, sum(v) v from (
                    select supplier_id sid, total v, received_at t from purchase_receipts where status = 'COMPLETED'
                    union all
                    select supplier_id, -total, returned_at from purchase_returns where status = 'COMPLETED'
                  ) y where sid is not null%s group by sid) b on b.sid = s.id""".formatted(LEDGER, buyWhere) + where;
    }

    private static void range(StringBuilder where, MapSqlParameterSource p, String expr, String key, BigDecimal from,
                              BigDecimal to) {
        if (from != null) {
            where.append(" and ").append(expr).append(" >= :").append(key).append("From");
            p.addValue(key + "From", from);
        }
        if (to != null) {
            where.append(" and ").append(expr).append(" <= :").append(key).append("To");
            p.addValue(key + "To", to);
        }
    }
}
