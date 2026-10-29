package com.vaxclinic.product.report;

import com.vaxclinic.product.report.SupplierReportRepository.SupplierDebtRow;
import com.vaxclinic.product.report.SupplierReportRepository.SupplierRow;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Báo cáo nhà cung cấp: kiểm tra kỳ báo cáo + giới hạn chi nhánh của người dùng, đọc từ {@link SupplierReportRepository}. */
@Service
public class SupplierReportService {

    private final SupplierReportRepository repo;

    public SupplierReportService(SupplierReportRepository repo) {
        this.repo = repo;
    }

    public List<SupplierRow> summary(Instant from, Instant to, List<UUID> branchIds, boolean byProduct, List<String> branchClaim) {
        return repo.summary(ProductReportScope.params(from, to, branchIds, branchClaim), byProduct);
    }

    public List<SupplierDebtRow> debt(Instant from, Instant to, List<UUID> branchIds, List<String> branchClaim) {
        return repo.debt(ProductReportScope.params(from, to, branchIds, branchClaim));
    }
}
