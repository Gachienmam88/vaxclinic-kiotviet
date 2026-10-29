package com.vaxclinic.sales.report;

import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.report.FinanceReportRepository.MonthRow;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Báo cáo kết quả hoạt động kinh doanh theo tháng (giờ Việt Nam). Màn hình cộng các tháng thành quý / cả kỳ.
 * sales (1) = tiền hàng hóa đơn; invoiceDiscount (2.1); returnValue (2.2) = tiền hàng trả − giảm giá phiếu trả;
 * cogs (4) = giá vốn bán − giá vốn hàng trả (khớp sổ S2a); paymentDiscount = chiết khấu thanh toán (sổ công nợ CKTT, toàn cửa hàng);
 * salary = phiếu chi hạch toán có loại chứa "lương"; otherExpense (9) = phiếu chi hạch toán còn lại (trừ trả NCC);
 * returnFee (8) = phí trả hàng; otherIncome (8) = phiếu thu tay có hạch toán. Xuất hủy lấy từ product-service.
 * deliveryFee = Phí trả ĐTGH: phí giao hàng cửa hàng chịu, ghi vào sổ công nợ đối tác giao hàng (FEE) khi vận đơn
 * giao thành công / chuyển hoàn (phiếu đối soát chỉ là thanh toán, không hạch toán lần 2).
 * Nghiệp vụ ở {@link FinanceReportService}.
 */
@RestController
@PreAuthorize("hasAuthority('report.view')")
public class FinanceReportController {

    private final FinanceReportService service;

    public FinanceReportController(FinanceReportService service) {
        this.service = service;
    }

    @GetMapping("/api/reports/finance")
    public List<MonthRow> finance(ReportFilter f, @AuthenticationPrincipal Jwt jwt) {
        return service.finance(f, Actor.of(jwt));
    }
}
