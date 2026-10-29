package com.vaxclinic.sales.accounting;

import com.vaxclinic.sales.accounting.SellerRevenueRepository.SellerRevenue;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

/**
 * Doanh thu theo người bán × mặt hàng (identity-service tính hoa hồng nhân viên; chỉ JWT "internal", gateway không route /internal).
 * Cách tính ở {@link SellerRevenueRepository}.
 */
@RestController
public class SellerRevenueInternalController {

    private final SellerRevenueService service;

    public SellerRevenueInternalController(SellerRevenueService service) {
        this.service = service;
    }

    @GetMapping("/internal/seller-revenue")
    @PreAuthorize("hasAuthority('internal')")
    public List<SellerRevenue> revenue(@RequestParam LocalDate from, @RequestParam LocalDate to) {
        return service.revenue(from, to);
    }
}
