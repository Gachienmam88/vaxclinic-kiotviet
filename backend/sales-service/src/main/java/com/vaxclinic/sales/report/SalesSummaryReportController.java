package com.vaxclinic.sales.report;

import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.report.SalesSummaryReportRepository.SummaryRow;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Tổng hợp doanh thu theo 1 chiều: ngày (Báo cáo bán hàng – Thời gian), người bán (Nhân viên), chi nhánh, khách hàng,
 * kênh bán. Giá trị trả = tiền hàng trả − giảm giá phiếu trả (phí trả hàng không trừ doanh thu, tách riêng cột fee).
 * Doanh thu thuần = revenue − returnValue; giá vốn = giá vốn hàng bán − giá vốn hàng trả (theo giá vốn lúc bán).
 * Nghiệp vụ ở {@link SalesSummaryReportService}.
 */
@RestController
@PreAuthorize("hasAuthority('report.view')")
public class SalesSummaryReportController {

    private final SalesSummaryReportService service;

    public SalesSummaryReportController(SalesSummaryReportService service) {
        this.service = service;
    }

    /** groupBy: DAY | SELLER | BRANCH | CUSTOMER | CHANNEL (kênh bán lưu trên hóa đơn, phiếu trả theo hóa đơn gốc). */
    @GetMapping("/api/reports/sales/summary")
    public List<SummaryRow> summary(ReportFilter f, @RequestParam(defaultValue = "DAY") String groupBy,
                                    @AuthenticationPrincipal Jwt jwt) {
        return service.summary(f, groupBy, Actor.of(jwt));
    }
}
