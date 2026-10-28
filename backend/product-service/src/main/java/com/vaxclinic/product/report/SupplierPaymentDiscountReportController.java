package com.vaxclinic.product.report;

import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Chiết khấu thanh toán nhận từ NCC theo tháng (giờ Việt Nam) — dòng "Chiết khấu thanh toán nhận từ nhà cung cấp"
 * thuộc Thu nhập khác (8) của Báo cáo tài chính. Nguồn: sổ công nợ NCC, phiếu DISCOUNT (CKN…) còn hiệu lực, theo chi nhánh lập phiếu.
 */
@RestController
@PreAuthorize("hasAuthority('report.view')")
public class SupplierPaymentDiscountReportController {

    private final NamedParameterJdbcTemplate jdbc;

    public SupplierPaymentDiscountReportController(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping("/api/reports/suppliers/payment-discounts/monthly")
    public List<InventoryReportController.MonthValue> monthly(@RequestParam Instant from, @RequestParam Instant to,
                                                              @RequestParam(required = false) List<UUID> branchIds,
                                                              @AuthenticationPrincipal Jwt jwt) {
        return jdbc.query("""
                select to_char(d.occurred_at at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM') m, sum(d.amount) val
                from supplier_debt_docs d
                where d.kind = 'DISCOUNT' and d.status = 'ACTIVE' and d.occurred_at >= :from and d.occurred_at < :to
                  and d.branch_id in (:branches)
                group by 1 order by 1""", ProductReportScope.params(from, to, branchIds, jwt),
                (rs, n) -> new InventoryReportController.MonthValue(rs.getString("m"), rs.getBigDecimal("val")));
    }
}
