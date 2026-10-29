package com.vaxclinic.product.report;

import com.vaxclinic.product.report.InventoryReportRepository.MonthValue;
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
 * Nghiệp vụ ở {@link SupplierPaymentDiscountReportService}.
 */
@RestController
@PreAuthorize("hasAuthority('report.view')")
public class SupplierPaymentDiscountReportController {

    private final SupplierPaymentDiscountReportService service;

    public SupplierPaymentDiscountReportController(SupplierPaymentDiscountReportService service) {
        this.service = service;
    }

    @GetMapping("/api/reports/suppliers/payment-discounts/monthly")
    public List<MonthValue> monthly(@RequestParam Instant from, @RequestParam Instant to,
                                    @RequestParam(required = false) List<UUID> branchIds, @AuthenticationPrincipal Jwt jwt) {
        return service.monthly(from, to, branchIds, jwt.getClaimAsStringList("branches"));
    }
}
