package com.vaxclinic.sales.accounting;

import com.vaxclinic.sales.accounting.SellerRevenueRepository.SellerRevenue;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;

/** Doanh thu theo người bán × mặt hàng cho identity-service tính hoa hồng nhân viên. */
@Service
public class SellerRevenueService {

    private final SellerRevenueRepository repo;

    public SellerRevenueService(SellerRevenueRepository repo) {
        this.repo = repo;
    }

    public List<SellerRevenue> revenue(LocalDate from, LocalDate to) {
        return repo.revenue(from, to);
    }
}
