package com.vaxclinic.product.report;

import com.vaxclinic.product.report.InventoryReportRepository.DamageRow;
import com.vaxclinic.product.report.InventoryReportRepository.MonthValue;
import com.vaxclinic.product.report.InventoryReportRepository.MovementRow;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Báo cáo hàng hóa phía kho: kiểm tra kỳ báo cáo + giới hạn chi nhánh của người dùng, đọc từ {@link InventoryReportRepository}. */
@Service
public class InventoryReportService {

    private final InventoryReportRepository repo;

    public InventoryReportService(InventoryReportRepository repo) {
        this.repo = repo;
    }

    public List<MovementRow> movement(Instant from, Instant to, List<UUID> branchIds, List<String> branchClaim) {
        return repo.movement(ProductReportScope.params(from, to, branchIds, branchClaim));
    }

    public List<DamageRow> damages(Instant from, Instant to, List<UUID> branchIds, List<String> branchClaim) {
        return repo.damages(ProductReportScope.params(from, to, branchIds, branchClaim));
    }

    public List<MonthValue> damagesMonthly(Instant from, Instant to, List<UUID> branchIds, List<String> branchClaim) {
        return repo.damagesMonthly(ProductReportScope.params(from, to, branchIds, branchClaim));
    }
}
