package com.vaxclinic.sales.report.controller;

import com.vaxclinic.sales.report.service.ProductSalesReportQuery;
import com.vaxclinic.sales.report.dto.ReportFilter;
import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.report.service.ProductSalesReportQuery.ProductRow;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Báo cáo bán hàng theo hàng hóa (và Hàng bán theo khách / theo nhân viên). Xem {@link ProductSalesReportQuery}.
 */
@RestController
@PreAuthorize("hasAuthority('report.view')")
public class ProductSalesReportController {

    private final ProductSalesReportQuery query;

    public ProductSalesReportController(ProductSalesReportQuery query) {
        this.query = query;
    }

    @GetMapping("/api/reports/sales/products")
    public List<ProductRow> products(ReportFilter f, @RequestParam(defaultValue = "NONE") String by,
                                     @RequestParam(defaultValue = "false") boolean merge, @AuthenticationPrincipal Jwt jwt) {
        return query.products(f, by, merge, Actor.of(jwt));
    }
}
