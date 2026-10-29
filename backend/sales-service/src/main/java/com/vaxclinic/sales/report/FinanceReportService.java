package com.vaxclinic.sales.report;

import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.report.FinanceReportRepository.MonthRow;
import org.springframework.stereotype.Service;

import java.util.List;

/** Báo cáo tài chính: kiểm tra kỳ báo cáo + giới hạn chi nhánh của người dùng, đọc từ {@link FinanceReportRepository}. */
@Service
public class FinanceReportService {

    private final FinanceReportRepository repo;

    public FinanceReportService(FinanceReportRepository repo) {
        this.repo = repo;
    }

    public List<MonthRow> finance(ReportFilter f, Actor actor) {
        return repo.finance(f, f.params(actor));
    }
}
