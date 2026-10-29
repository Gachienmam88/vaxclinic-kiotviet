package com.vaxclinic.sales.accounting;

import com.vaxclinic.sales.accounting.RevenueBookRepository.DailyExpense;
import com.vaxclinic.sales.accounting.RevenueBookRepository.DailyRevenue;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Số liệu Sổ doanh thu bán hàng hóa, dịch vụ và tờ khai thuế hộ kinh doanh (đọc từ {@link RevenueBookRepository}). */
@Service
public class RevenueBookService {

    private final RevenueBookRepository repo;

    public RevenueBookService(RevenueBookRepository repo) {
        this.repo = repo;
    }

    public List<DailyRevenue> daily(LocalDate from, LocalDate to, List<UUID> branchIds) {
        return repo.daily(from, to, branchIds);
    }

    public List<DailyExpense> expenses(LocalDate from, LocalDate to, List<UUID> branchIds) {
        return repo.expenses(from, to, branchIds);
    }
}
