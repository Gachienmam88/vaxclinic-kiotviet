package com.vaxclinic.sales.report.controller;

import com.vaxclinic.sales.report.service.FinanceReportQuery;
import com.vaxclinic.sales.report.dto.ReportFilter;
import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.report.service.FinanceReportQuery.MonthRow;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Báo cáo kết quả hoạt động kinh doanh theo tháng (giờ Việt Nam). Xem {@link FinanceReportQuery}. */
@RestController
@PreAuthorize("hasAuthority('report.view')")
public class FinanceReportController {

    private final FinanceReportQuery query;

    public FinanceReportController(FinanceReportQuery query) {
        this.query = query;
    }

    @GetMapping("/api/reports/finance")
    public List<MonthRow> finance(ReportFilter f, @AuthenticationPrincipal Jwt jwt) {
        return query.finance(f, Actor.of(jwt));
    }
}
