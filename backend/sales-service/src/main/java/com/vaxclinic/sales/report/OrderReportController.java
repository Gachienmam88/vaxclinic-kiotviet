package com.vaxclinic.sales.report;

import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.report.OrderReportRepository.OrderProductRow;
import com.vaxclinic.sales.report.OrderReportRepository.OrderRow;
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
 * riêng nên "Thời gian giao hàng" chỉ có Toàn thời gian. Nghiệp vụ ở {@link OrderReportService}.
 */
@RestController
@PreAuthorize("hasAuthority('report.view')")
public class OrderReportController {

    private final OrderReportService service;

    public OrderReportController(OrderReportService service) {
        this.service = service;
    }

    @GetMapping("/api/reports/orders/products")
    public List<OrderProductRow> products(ReportFilter f, @RequestParam(required = false) List<String> statuses,
                                          @RequestParam(defaultValue = "false") boolean merge, @AuthenticationPrincipal Jwt jwt) {
        return service.products(f, statuses, merge, Actor.of(jwt));
    }

    @GetMapping("/api/reports/orders/transactions")
    public List<OrderRow> transactions(ReportFilter f, @RequestParam(required = false) List<String> statuses,
                                       @AuthenticationPrincipal Jwt jwt) {
        return service.transactions(f, statuses, Actor.of(jwt));
    }
}
