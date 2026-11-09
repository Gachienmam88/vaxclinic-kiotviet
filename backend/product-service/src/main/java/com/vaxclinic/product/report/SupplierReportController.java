package com.vaxclinic.product.report;

import com.vaxclinic.product.report.SupplierReportQuery.SupplierDebtRow;
import com.vaxclinic.product.report.SupplierReportQuery.SupplierRow;
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
 * Báo cáo nhà cung cấp: Nhập hàng (theo NCC), Hàng nhập theo NCC (NCC × hàng) và Công nợ NCC.
 * Giá trị nhập / trả = tổng cộng phiếu (sau giảm giá, gồm VAT) — dòng hàng được phân bổ theo tỷ lệ tiền hàng.
 * Công nợ NCC = Σ tổng phiếu nhập − Σ (tổng phiếu trả hàng nhập − NCC đã hoàn) của phiếu hoàn thành
 * − Σ thanh toán (kể cả phiếu chi lúc nhập hàng) − Σ chiết khấu thanh toán ± điều chỉnh (sổ supplier_debt_docs còn hiệu lực).
 */
@RestController
@PreAuthorize("hasAuthority('report.view')")
public class SupplierReportController {

    private final SupplierReportQuery query;

    public SupplierReportController(SupplierReportQuery query) {
        this.query = query;
    }

    /** byProduct = false: 1 dòng / NCC (giá trị nhập theo tổng phiếu); true: 1 dòng / NCC × hàng (đơn vị cơ bản). */
    @GetMapping("/api/reports/suppliers/summary")
    public List<SupplierRow> summary(@RequestParam Instant from, @RequestParam Instant to,
                                     @RequestParam(required = false) List<UUID> branchIds,
                                     @RequestParam(defaultValue = "false") boolean byProduct, @AuthenticationPrincipal Jwt jwt) {
        return query.summary(byProduct, ProductReportScope.params(from, to, branchIds, jwt));
    }

    @GetMapping("/api/reports/suppliers/debt")
    public List<SupplierDebtRow> debt(@RequestParam Instant from, @RequestParam Instant to,
                                      @RequestParam(required = false) List<UUID> branchIds, @AuthenticationPrincipal Jwt jwt) {
        return query.debt(ProductReportScope.params(from, to, branchIds, jwt));
    }
}
