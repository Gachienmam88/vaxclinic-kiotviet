package com.vaxclinic.sales.report;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.report.SalesSummaryReportRepository.SummaryRow;
import org.springframework.stereotype.Service;

import java.util.List;

/** Tổng hợp doanh thu theo 1 chiều: kiểm tra kiểu nhóm, kỳ báo cáo, chi nhánh của người dùng rồi đọc từ repository. */
@Service
public class SalesSummaryReportService {

    private final SalesSummaryReportRepository repo;

    public SalesSummaryReportService(SalesSummaryReportRepository repo) {
        this.repo = repo;
    }

    public List<SummaryRow> summary(ReportFilter f, String groupBy, Actor actor) {
        if (!SalesSummaryReportRepository.supportsGroup(groupBy)) {
            throw BusinessException.badRequest("REPORT_GROUP_INVALID", "Kiểu nhóm báo cáo không hợp lệ");
        }
        return repo.summary(f, groupBy, f.params(actor));
    }
}
