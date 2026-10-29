package com.vaxclinic.sales.report;

import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.report.ProductSalesReportRepository.ProductRow;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Báo cáo bán hàng theo hàng hóa (và Hàng bán theo khách / theo nhân viên). Doanh thu dòng = phân bổ giảm giá hóa đơn
 * theo tỷ lệ tiền hàng (cùng công thức Sổ doanh thu S1a/S2a); giá trị trả = phân bổ (tiền hàng trả − giảm giá phiếu trả).
 * merge = Gộp hàng hóa cùng loại: gộp mọi đơn vị tính của 1 hàng, số lượng quy về đơn vị cơ bản (theo lô đã xuất / nhập lại).
 * Nghiệp vụ ở {@link ProductSalesReportService}.
 */
@RestController
@PreAuthorize("hasAuthority('report.view')")
public class ProductSalesReportController {

    private final ProductSalesReportService service;

    public ProductSalesReportController(ProductSalesReportService service) {
        this.service = service;
    }

    @GetMapping("/api/reports/sales/products")
    public List<ProductRow> products(ReportFilter f, @RequestParam(defaultValue = "NONE") String by,
                                     @RequestParam(defaultValue = "false") boolean merge, @AuthenticationPrincipal Jwt jwt) {
        return service.products(f, by, merge, Actor.of(jwt));
    }
}
