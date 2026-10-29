package com.vaxclinic.sales.report;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.sales.report.CustomerDebtReportRepository.DebtRow;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Báo cáo khách hàng – Công nợ: kiểm tra khoảng thời gian rồi đọc từ {@link CustomerDebtReportRepository}. */
@Service
public class CustomerDebtReportService {

    private final CustomerDebtReportRepository repo;

    public CustomerDebtReportService(CustomerDebtReportRepository repo) {
        this.repo = repo;
    }

    public List<DebtRow> debt(Instant from, Instant to, UUID customerId) {
        if (!from.isBefore(to)) {
            throw BusinessException.badRequest("REPORT_RANGE_INVALID", "Khoảng thời gian báo cáo không hợp lệ");
        }
        return repo.debt(from, to, customerId);
    }
}
