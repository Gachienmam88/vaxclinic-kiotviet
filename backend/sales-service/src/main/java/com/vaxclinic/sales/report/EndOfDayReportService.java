package com.vaxclinic.sales.report;

import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.report.EndOfDayReportRepository.DocRow;
import com.vaxclinic.sales.report.EndOfDayReportRepository.VoucherRow;
import org.springframework.stereotype.Service;

import java.util.List;

/** Báo cáo cuối ngày: kiểm tra kỳ báo cáo + giới hạn chi nhánh của người dùng, đọc từ {@link EndOfDayReportRepository}. */
@Service
public class EndOfDayReportService {

    private final EndOfDayReportRepository repo;

    public EndOfDayReportService(EndOfDayReportRepository repo) {
        this.repo = repo;
    }

    public List<DocRow> sales(ReportFilter f, Actor actor) {
        return repo.sales(f, f.params(actor));
    }

    public List<VoucherRow> cashflow(ReportFilter f, List<String> funds, Actor actor) {
        return repo.cashflow(f, funds, f.params(actor));
    }
}
