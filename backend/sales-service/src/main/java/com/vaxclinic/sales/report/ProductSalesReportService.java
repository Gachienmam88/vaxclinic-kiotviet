package com.vaxclinic.sales.report;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.report.ProductSalesReportRepository.ProductRow;
import org.springframework.stereotype.Service;

import java.util.List;

/** Báo cáo bán hàng theo hàng hóa: kiểm tra kiểu nhóm, kỳ báo cáo, chi nhánh của người dùng rồi đọc từ repository. */
@Service
public class ProductSalesReportService {

    private final ProductSalesReportRepository repo;

    public ProductSalesReportService(ProductSalesReportRepository repo) {
        this.repo = repo;
    }

    public List<ProductRow> products(ReportFilter f, String by, boolean merge, Actor actor) {
        if (!ProductSalesReportRepository.supportsGroup(by)) {
            throw BusinessException.badRequest("REPORT_GROUP_INVALID", "Kiểu nhóm báo cáo không hợp lệ");
        }
        return repo.products(f, by, merge, f.params(actor));
    }
}
