package com.vaxclinic.sales.report.controller;

import com.vaxclinic.sales.report.service.OrderReportQuery;
import com.vaxclinic.sales.report.dto.ReportFilter;
import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.report.service.OrderReportQuery.OrderProductRow;
import com.vaxclinic.sales.report.service.OrderReportQuery.OrderRow;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Báo cáo đặt hàng: theo Hàng hóa (SL đặt, giá trị đặt đã phân bổ giảm giá đơn, SL đã tạo hóa đơn) và theo Giao dịch
 * (từng đơn). Lọc theo thời gian đặt hàng, trạng thái, khách hàng, hàng hóa (q: mã / tên). Đơn chưa có ngày giao hàng
 * riêng nên "Thời gian giao hàng" chỉ có Toàn thời gian.
 */
@RestController
@PreAuthorize("hasAuthority('report.view')")
public class OrderReportController {

    private final OrderReportQuery query;

    public OrderReportController(OrderReportQuery query) {
        this.query = query;
    }

    @GetMapping("/api/reports/orders/products")
    public List<OrderProductRow> products(ReportFilter f, @RequestParam(required = false) List<String> statuses,
                                          @RequestParam(defaultValue = "false") boolean merge, @AuthenticationPrincipal Jwt jwt) {
        return query.products(f, statuses, merge, Actor.of(jwt));
    }

    @GetMapping("/api/reports/orders/transactions")
    public List<OrderRow> transactions(ReportFilter f, @RequestParam(required = false) List<String> statuses,
                                       @AuthenticationPrincipal Jwt jwt) {
        return query.transactions(f, statuses, Actor.of(jwt));
    }
}
