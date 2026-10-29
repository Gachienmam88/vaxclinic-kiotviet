package com.vaxclinic.sales.report;

import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.report.OrderReportRepository.OrderProductRow;
import com.vaxclinic.sales.report.OrderReportRepository.OrderRow;
import org.springframework.stereotype.Service;

import java.util.List;

/** Báo cáo đặt hàng: kiểm tra kỳ báo cáo + giới hạn chi nhánh của người dùng, đọc từ {@link OrderReportRepository}. */
@Service
public class OrderReportService {

    private final OrderReportRepository repo;

    public OrderReportService(OrderReportRepository repo) {
        this.repo = repo;
    }

    public List<OrderProductRow> products(ReportFilter f, List<String> statuses, boolean merge, Actor actor) {
        return repo.products(f, statuses, merge, f.params(actor));
    }

    public List<OrderRow> transactions(ReportFilter f, List<String> statuses, Actor actor) {
        return repo.transactions(f, statuses, f.params(actor));
    }
}
