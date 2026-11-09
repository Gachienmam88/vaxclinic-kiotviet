package com.vaxclinic.sales.report.controller;

import com.vaxclinic.sales.report.service.EndOfDayReportQuery;
import com.vaxclinic.sales.report.dto.ReportFilter;
import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.report.service.EndOfDayReportQuery.DocRow;
import com.vaxclinic.sales.report.service.EndOfDayReportQuery.VoucherRow;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Báo cáo cuối ngày (KiotViet): Bán hàng = từng hóa đơn / phiếu trả trong kỳ kèm tiền thực thu trong kỳ;
 * Thu chi = các phiếu thu / chi của Sổ quỹ trong kỳ. Màn hình tự nhóm theo phương thức thanh toán / tài khoản.
 */
@RestController
@PreAuthorize("hasAuthority('report.view')")
public class EndOfDayReportController {

    private final EndOfDayReportQuery query;

    public EndOfDayReportController(EndOfDayReportQuery query) {
        this.query = query;
    }

    @GetMapping("/api/reports/end-of-day/sales")
    public List<DocRow> sales(ReportFilter f, @AuthenticationPrincipal Jwt jwt) {
        return query.sales(f, Actor.of(jwt));
    }

    /** Phiếu thu/chi đã thanh toán trong kỳ. funds: CASH/BANK/EWALLET; partnerId: khách hàng; collectorId: nhân viên thu/chi. */
    @GetMapping("/api/reports/end-of-day/cashflow")
    public List<VoucherRow> cashflow(ReportFilter f, @RequestParam(required = false) List<String> funds,
                                     @AuthenticationPrincipal Jwt jwt) {
        return query.cashflow(f, funds, Actor.of(jwt));
    }
}
