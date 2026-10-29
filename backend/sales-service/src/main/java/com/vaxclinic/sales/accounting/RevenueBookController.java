package com.vaxclinic.sales.accounting;

import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import com.vaxclinic.common.security.BranchScope;
import com.vaxclinic.sales.accounting.RevenueBookRepository.DailyExpense;
import com.vaxclinic.sales.accounting.RevenueBookRepository.DailyRevenue;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Số liệu cho Sổ doanh thu bán hàng hóa, dịch vụ (S1a/S2a/S2b-HKD) và tờ khai thuế hộ kinh doanh.
 * Doanh thu theo NGÀY (giờ Việt Nam) và theo MÃ THUẾ của dòng hàng: hóa đơn hoàn thành − hàng khách trả.
 * Nghiệp vụ ở {@link RevenueBookService}.
 */
@RestController
public class RevenueBookController {

    private final RevenueBookService service;

    public RevenueBookController(RevenueBookService service) {
        this.service = service;
    }

    @GetMapping("/api/accounting/revenue/daily")
    @PreAuthorize("hasAuthority('report.view') or hasAuthority('cashbook.manage')")
    public List<DailyRevenue> daily(@RequestParam LocalDate from, @RequestParam LocalDate to,
                                    @RequestParam(required = false) List<UUID> branchIds, @AuthenticationPrincipal Jwt jwt) {
        return service.daily(from, to, BranchScope.resolve(jwt, branchIds)); // rỗng = chi nhánh được xem; ngoài phạm vi → 403
    }

    @GetMapping("/api/accounting/revenue/expenses")
    @PreAuthorize("hasAuthority('report.view') or hasAuthority('cashbook.manage')")
    public List<DailyExpense> expenses(@RequestParam LocalDate from, @RequestParam LocalDate to,
                                       @RequestParam(required = false) List<UUID> branchIds, @AuthenticationPrincipal Jwt jwt) {
        return service.expenses(from, to, BranchScope.resolve(jwt, branchIds));
    }
}
