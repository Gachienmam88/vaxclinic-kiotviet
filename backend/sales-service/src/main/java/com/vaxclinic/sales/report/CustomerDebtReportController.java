package com.vaxclinic.sales.report;

import com.vaxclinic.sales.report.CustomerDebtReportRepository.DebtRow;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Báo cáo công nợ khách hàng (Báo cáo khách hàng – Công nợ) từ sổ công nợ: nợ đầu kỳ, ghi nợ (phát sinh tăng: bán hàng,
 * điều chỉnh tăng, hoàn cọc), ghi có (phát sinh giảm: thanh toán, chiết khấu, trả hàng), nợ cuối kỳ. Sổ công nợ theo
 * khách (không tách chi nhánh) nên báo cáo này tính trên toàn cửa hàng. Nghiệp vụ ở {@link CustomerDebtReportService}.
 */
@RestController
@PreAuthorize("hasAuthority('report.view')")
public class CustomerDebtReportController {

    private final CustomerDebtReportService service;

    public CustomerDebtReportController(CustomerDebtReportService service) {
        this.service = service;
    }

    @GetMapping("/api/reports/customers/debt")
    public List<DebtRow> debt(@RequestParam Instant from, @RequestParam Instant to, @RequestParam(required = false) UUID customerId) {
        return service.debt(from, to, customerId);
    }
}
