package com.vaxclinic.product.report;

import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Báo cáo hàng hóa phía kho: Xuất nhập tồn chi tiết (biến động thẻ kho theo loại chứng từ, đơn vị cơ bản) và Xuất hủy.
 * Giá trị: chứng từ với NCC (tồn đầu, nhập, trả hàng nhập) theo giá giao dịch, còn lại theo giá vốn lúc phát sinh
 * (cùng quy ước Sổ S2d-HKD). docType "BEFORE" = tồn trước kỳ.
 */
@RestController
@PreAuthorize("hasAuthority('report.view')")
public class InventoryReportController {

    public record MovementRow(UUID productId, String code, String name, String unit, String docType, BigDecimal qty, BigDecimal value) {
    }

    public record MonthValue(String month, BigDecimal value) {
    }

    public record DamageRow(UUID productId, String code, String name, String unit, BigDecimal qty, BigDecimal value, long docCount) {
    }

    private final NamedParameterJdbcTemplate jdbc;

    public InventoryReportController(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping("/api/reports/inventory/movement-detail")
    public List<MovementRow> movement(@RequestParam Instant from, @RequestParam Instant to,
                                      @RequestParam(required = false) List<UUID> branchIds, @AuthenticationPrincipal Jwt jwt) {
        return jdbc.query("""
                select s.product_id, u.code, p.name, u.unit_name,
                  case when s.occurred_at < :from then 'BEFORE' else s.doc_type end dt, sum(s.quantity) qty,
                  sum(round(s.quantity * case when s.doc_type in ('OPENING','PURCHASE','PURCHASE_CANCEL','PURCHASE_RETURN','PURCHASE_RETURN_CANCEL')
                                              then s.unit_price else s.cost end)) val
                from stock_ledger s join products p on p.id = s.product_id
                left join product_units u on u.product_id = p.id and u.is_base
                where s.occurred_at < :to and s.branch_id in (:branches)
                group by 1, 2, 3, 4, 5 order by 3, 5""", ProductReportScope.params(from, to, branchIds, jwt),
                (rs, n) -> new MovementRow(rs.getObject("product_id", UUID.class), rs.getString("code"), rs.getString("name"),
                        rs.getString("unit_name"), rs.getString("dt"), rs.getBigDecimal("qty"), rs.getBigDecimal("val")));
    }

    /** Phiếu xuất hủy đã hoàn thành trong kỳ, theo hàng (SL đơn vị cơ bản, giá trị theo giá vốn trên phiếu). */
    @GetMapping("/api/reports/inventory/damages")
    public List<DamageRow> damages(@RequestParam Instant from, @RequestParam Instant to,
                                   @RequestParam(required = false) List<UUID> branchIds, @AuthenticationPrincipal Jwt jwt) {
        return jdbc.query("""
                select l.product_id, u.code, p.name, u.unit_name, sum(l.quantity * l.conversion_rate) qty,
                  sum(round(l.quantity * l.unit_cost)) val, count(distinct d.id) n
                from stock_issues d join stock_issue_lines l on l.issue_id = d.id join products p on p.id = l.product_id
                left join product_units u on u.product_id = p.id and u.is_base
                where d.type = 'DAMAGE' and d.status = 'COMPLETED' and d.issued_at >= :from and d.issued_at < :to
                  and d.branch_id in (:branches)
                group by 1, 2, 3, 4 order by val desc""", ProductReportScope.params(from, to, branchIds, jwt),
                (rs, n) -> new DamageRow(rs.getObject("product_id", UUID.class), rs.getString("code"), rs.getString("name"),
                        rs.getString("unit_name"), rs.getBigDecimal("qty"), rs.getBigDecimal("val"), rs.getLong("n")));
    }

    /** Giá trị xuất hủy theo tháng (giờ Việt Nam) — dòng "Xuất hủy hàng hóa" của Báo cáo tài chính. */
    @GetMapping("/api/reports/inventory/damages/monthly")
    public List<MonthValue> damagesMonthly(@RequestParam Instant from, @RequestParam Instant to,
                                           @RequestParam(required = false) List<UUID> branchIds, @AuthenticationPrincipal Jwt jwt) {
        return jdbc.query("""
                select to_char(d.issued_at at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM') m, sum(round(l.quantity * l.unit_cost)) val
                from stock_issues d join stock_issue_lines l on l.issue_id = d.id
                where d.type = 'DAMAGE' and d.status = 'COMPLETED' and d.issued_at >= :from and d.issued_at < :to
                  and d.branch_id in (:branches)
                group by 1 order by 1""", ProductReportScope.params(from, to, branchIds, jwt),
                (rs, n) -> new MonthValue(rs.getString("m"), rs.getBigDecimal("val")));
    }
}