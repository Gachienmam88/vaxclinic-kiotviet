package com.vaxclinic.product.report;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * Báo cáo nhà cung cấp: Nhập hàng (theo NCC), Hàng nhập theo NCC (NCC × hàng) và Công nợ NCC.
 * Giá trị nhập / trả = tổng cộng phiếu (sau giảm giá, gồm VAT) — dòng hàng được phân bổ theo tỷ lệ tiền hàng.
 * Công nợ NCC = Σ tổng phiếu nhập − Σ (tổng phiếu trả hàng nhập − NCC đã hoàn) của phiếu hoàn thành
 * − Σ thanh toán (kể cả phiếu chi lúc nhập hàng) − Σ chiết khấu thanh toán ± điều chỉnh (sổ supplier_debt_docs còn hiệu lực).
 * Tham số từ {@code ProductReportScope.params}.
 */
@Component
public class SupplierReportQuery {

    public record SupplierRow(UUID supplierId, String supplierCode, String supplierName, UUID productId, String productCode,
                              String productName, String unit, BigDecimal qtyIn, BigDecimal valueIn, BigDecimal qtyReturned,
                              BigDecimal valueReturned, long receiptCount) {
    }

    public record SupplierDebtRow(UUID supplierId, String code, String name, String phone, BigDecimal opening, BigDecimal debit,
                                  BigDecimal credit, BigDecimal closing) {
    }

    private static final String DOCS = """
            select r.supplier_id, r.id doc, r.received_at t, 1 kind, l.product_id, l.quantity * l.conversion_rate q,
              case when r.subtotal = 0 then 0 else round(r.total * l.quantity * (l.unit_price - l.discount) / r.subtotal) end v
            from purchase_receipts r join purchase_receipt_lines l on l.receipt_id = r.id
            where r.status = 'COMPLETED' and r.received_at >= :from and r.received_at < :to and r.branch_id in (:branches)
            union all
            select r.supplier_id, r.id, r.returned_at, -1, l.product_id, l.quantity * l.conversion_rate,
              case when r.subtotal = 0 then 0 else round(r.total * l.quantity * l.unit_price / r.subtotal) end
            from purchase_returns r join purchase_return_lines l on l.return_id = r.id
            where r.status = 'COMPLETED' and r.returned_at >= :from and r.returned_at < :to and r.branch_id in (:branches)""";

    private final NamedParameterJdbcTemplate jdbc;

    public SupplierReportQuery(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** byProduct = false: 1 dòng / NCC (giá trị nhập theo tổng phiếu); true: 1 dòng / NCC × hàng (đơn vị cơ bản). */
    public List<SupplierRow> summary(boolean byProduct, MapSqlParameterSource params) {
        String productCols = byProduct ? "x.product_id, u.code, p.name, u.unit_name" : "null::uuid, null, null, null";
        String productJoin = byProduct ? " join products p on p.id = x.product_id left join product_units u on u.product_id = p.id and u.is_base" : "";
        return jdbc.query("""
                with x as (%s)
                select x.supplier_id, s.code scode, coalesce(s.name, 'Không có nhà cung cấp') sname, %s,
                  sum(case when kind = 1 then q else 0 end) qi, sum(case when kind = 1 then v else 0 end) vi,
                  sum(case when kind = -1 then q else 0 end) qr, sum(case when kind = -1 then v else 0 end) vr,
                  count(distinct case when kind = 1 then doc end) n
                from x left join suppliers s on s.id = x.supplier_id%s
                group by 1, 2, 3, 4, 5, 6, 7 order by sum(kind * v) desc""".formatted(DOCS, productCols, productJoin),
                params, (rs, n) -> new SupplierRow(rs.getObject(1, UUID.class),
                        rs.getString("scode"), rs.getString("sname"), rs.getObject(4, UUID.class), rs.getString(5), rs.getString(6),
                        rs.getString(7), rs.getBigDecimal("qi"), rs.getBigDecimal("vi"), rs.getBigDecimal("qr"),
                        rs.getBigDecimal("vr"), rs.getLong("n")));
    }

    public List<SupplierDebtRow> debt(MapSqlParameterSource params) {
        return jdbc.query("""
                with m as (
                  select supplier_id, received_at t, total dr, 0 cr from purchase_receipts
                  where status = 'COMPLETED' and received_at < :to and branch_id in (:branches) and supplier_id is not null
                  union all
                  select supplier_id, returned_at, 0, total - refund_amount from purchase_returns
                  where status = 'COMPLETED' and returned_at < :to and branch_id in (:branches) and supplier_id is not null
                  union all
                  select supplier_id, occurred_at, case when kind = 'ADJUSTMENT' then greatest(amount, 0) else 0 end,
                    case when kind = 'ADJUSTMENT' then greatest(-amount, 0) else amount end from supplier_debt_docs
                  where status = 'ACTIVE' and occurred_at < :to and branch_id in (:branches)
                )
                select s.id, s.code, s.name, s.phone,
                  coalesce(sum(m.dr - m.cr) filter (where m.t < :from), 0) opening,
                  coalesce(sum(m.dr) filter (where m.t >= :from), 0) debit,
                  coalesce(sum(m.cr) filter (where m.t >= :from), 0) credit
                from m join suppliers s on s.id = m.supplier_id
                group by s.id, s.code, s.name, s.phone order by s.code""", params,
                (rs, n) -> {
                    BigDecimal o = rs.getBigDecimal("opening"), dr = rs.getBigDecimal("debit"), cr = rs.getBigDecimal("credit");
                    return new SupplierDebtRow(rs.getObject("id", UUID.class), rs.getString("code"), rs.getString("name"),
                            rs.getString("phone"), o, dr, cr, o.add(dr).subtract(cr));
                });
    }
}
