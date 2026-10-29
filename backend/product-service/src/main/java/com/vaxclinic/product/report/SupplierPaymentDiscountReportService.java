package com.vaxclinic.product.report;

import com.vaxclinic.product.report.InventoryReportRepository.MonthValue;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Chiết khấu thanh toán nhận từ NCC: kiểm tra kỳ báo cáo + giới hạn chi nhánh, đọc từ {@link SupplierPaymentDiscountReportRepository}. */
@Service
public class SupplierPaymentDiscountReportService {

    private final SupplierPaymentDiscountReportRepository repo;

    public SupplierPaymentDiscountReportService(SupplierPaymentDiscountReportRepository repo) {
        this.repo = repo;
    }

    public List<MonthValue> monthly(Instant from, Instant to, List<UUID> branchIds, List<String> branchClaim) {
        return repo.monthly(ProductReportScope.params(from, to, branchIds, branchClaim));
    }
}
