package com.vaxclinic.product.report;

import com.vaxclinic.product.report.SupplierReportRepository.SupplierDebtRow;
import com.vaxclinic.product.report.SupplierReportRepository.SupplierRow;
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
 * Công nợ NCC = Σ tổng phiếu nhập − Σ tổng phiếu trả hàng nhập của phiếu hoàn thành + Σ NCC hoàn tiền (REFUND PT{THN})
 * − Σ thanh toán (kể cả phiếu chi lúc nhập hàng) − Σ chiết khấu thanh toán ± điều chỉnh (sổ supplier_debt_docs còn hiệu lực).
 * Nghiệp vụ ở {@link SupplierReportService}.
 */
@RestController
@PreAuthorize("hasAuthority('report.view')")
public class SupplierReportController {

    private final SupplierReportService service;

    public SupplierReportController(SupplierReportService service) {
        this.service = service;
    }

    /** byProduct = false: 1 dòng / NCC (giá trị nhập theo tổng phiếu); true: 1 dòng / NCC × hàng (đơn vị cơ bản). */
    @GetMapping("/api/reports/suppliers/summary")
    public List<SupplierRow> summary(@RequestParam Instant from, @RequestParam Instant to,
                                     @RequestParam(required = false) List<UUID> branchIds,
                                     @RequestParam(defaultValue = "false") boolean byProduct, @AuthenticationPrincipal Jwt jwt) {
        return service.summary(from, to, branchIds, byProduct, jwt.getClaimAsStringList("branches"));
    }

    @GetMapping("/api/reports/suppliers/debt")
    public List<SupplierDebtRow> debt(@RequestParam Instant from, @RequestParam Instant to,
                                      @RequestParam(required = false) List<UUID> branchIds, @AuthenticationPrincipal Jwt jwt) {
        return service.debt(from, to, branchIds, jwt.getClaimAsStringList("branches"));
    }
}
