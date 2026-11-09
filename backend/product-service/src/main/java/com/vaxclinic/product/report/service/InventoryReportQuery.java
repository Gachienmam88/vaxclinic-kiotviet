package com.vaxclinic.product.report.service;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * Báo cáo hàng hóa phía kho: Xuất nhập tồn chi tiết (biến động thẻ kho theo loại chứng từ, đơn vị cơ bản) và Xuất hủy.
 * Giá trị: chứng từ với NCC (tồn đầu, nhập, trả hàng nhập) theo giá giao dịch, còn lại theo giá vốn lúc phát sinh
 * (cùng quy ước Sổ S2d-HKD). docType "BEFORE" = tồn trước kỳ. Tham số từ {@code ProductReportScope.params}.
 */
@Component
public class InventoryReportQuery {

    public record MovementRow(UUID productId, String code, String name, String unit, String docType, BigDecimal qty, BigDecimal value) {
    }

    public record MonthValue(String month, BigDecimal value) {
    }

    public record DamageRow(UUID productId, String code, String name, String unit, BigDecimal qty, BigDecimal value, long docCount) {
    }

    private final NamedParameterJdbcTemplate jdbc;

    public InventoryReportQuery(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<MovementRow> movement(MapSqlParameterSource params) {
        return jdbc.query("""
                select s.product_id, u.code, p.name, u.unit_name,
                  case when s.occurred_at < :from then 'BEFORE' else s.doc_type end dt, sum(s.quantity) qty,
                  sum(round(s.quantity * case when s.doc_type in ('OPENING','PURCHASE','PURCHASE_CANCEL','PURCHASE_RETURN','PURCHASE_RETURN_CANCEL')
                                              then s.unit_price else s.cost end)) val
                from stock_ledger s join products p on p.id = s.product_id
                left join product_units u on u.product_id = p.id and u.is_base
                where s.occurred_at < :to and s.branch_id in (:branches)
                group by 1, 2, 3, 4, 5 order by 3, 5""", params,
                (rs, n) -> new MovementRow(rs.getObject("product_id", UUID.class), rs.getString("code"), rs.getString("name"),
                        rs.getString("unit_name"), rs.getString("dt"), rs.getBigDecimal("qty"), rs.getBigDecimal("val")));
    }

    /** Phiếu xuất hủy đã hoàn thành trong kỳ, theo hàng (SL đơn vị cơ bản, giá trị theo giá vốn trên phiếu). */
    public List<DamageRow> damages(MapSqlParameterSource params) {
        return jdbc.query("""
                select l.product_id, u.code, p.name, u.unit_name, sum(l.quantity * l.conversion_rate) qty,
                  sum(round(l.quantity * l.unit_cost)) val, count(distinct d.id) n
                from stock_issues d join stock_issue_lines l on l.issue_id = d.id join products p on p.id = l.product_id
                left join product_units u on u.product_id = p.id and u.is_base
                where d.type = 'DAMAGE' and d.status = 'COMPLETED' and d.issued_at >= :from and d.issued_at < :to
                  and d.branch_id in (:branches)
                group by 1, 2, 3, 4 order by val desc""", params,
                (rs, n) -> new DamageRow(rs.getObject("product_id", UUID.class), rs.getString("code"), rs.getString("name"),
                        rs.getString("unit_name"), rs.getBigDecimal("qty"), rs.getBigDecimal("val"), rs.getLong("n")));
    }

    /** Giá trị xuất hủy theo tháng (giờ Việt Nam) — dòng "Xuất hủy hàng hóa" của Báo cáo tài chính. */
    public List<MonthValue> damagesMonthly(MapSqlParameterSource params) {
        return jdbc.query("""
                select to_char(d.issued_at at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM') m, sum(round(l.quantity * l.unit_cost)) val
                from stock_issues d join stock_issue_lines l on l.issue_id = d.id
                where d.type = 'DAMAGE' and d.status = 'COMPLETED' and d.issued_at >= :from and d.issued_at < :to
                  and d.branch_id in (:branches)
                group by 1 order by 1""", params,
                (rs, n) -> new MonthValue(rs.getString("m"), rs.getBigDecimal("val")));
    }

    /**
     * Chiết khấu thanh toán nhận từ NCC theo tháng (giờ Việt Nam) — dòng "Chiết khấu thanh toán nhận từ nhà cung cấp"
     * thuộc Thu nhập khác (8) của Báo cáo tài chính. Nguồn: sổ công nợ NCC, phiếu DISCOUNT (CKN…) còn hiệu lực, theo chi nhánh lập phiếu.
     */
    public List<MonthValue> supplierPaymentDiscountsMonthly(MapSqlParameterSource params) {
        return jdbc.query("""
                select to_char(d.occurred_at at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM') m, sum(d.amount) val
                from supplier_debt_docs d
                where d.kind = 'DISCOUNT' and d.status = 'ACTIVE' and d.occurred_at >= :from and d.occurred_at < :to
                  and d.branch_id in (:branches)
                group by 1 order by 1""", params,
                (rs, n) -> new MonthValue(rs.getString("m"), rs.getBigDecimal("val")));
    }
}
