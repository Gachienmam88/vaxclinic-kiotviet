package com.vaxclinic.product.report;

import com.vaxclinic.product.report.InventoryReportRepository.DamageRow;
import com.vaxclinic.product.report.InventoryReportRepository.MonthValue;
import com.vaxclinic.product.report.InventoryReportRepository.MovementRow;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Báo cáo hàng hóa phía kho: Xuất nhập tồn chi tiết (biến động thẻ kho theo loại chứng từ, đơn vị cơ bản) và Xuất hủy.
 * Giá trị: chứng từ với NCC (tồn đầu, nhập, trả hàng nhập) theo giá giao dịch, còn lại theo giá vốn lúc phát sinh
 * (cùng quy ước Sổ S2d-HKD). docType "BEFORE" = tồn trước kỳ. Nghiệp vụ ở {@link InventoryReportService}.
 */
@RestController
@PreAuthorize("hasAuthority('report.view')")
public class InventoryReportController {

    private final InventoryReportService service;

    public InventoryReportController(InventoryReportService service) {
        this.service = service;
    }

    @GetMapping("/api/reports/inventory/movement-detail")
    public List<MovementRow> movement(@RequestParam Instant from, @RequestParam Instant to,
                                      @RequestParam(required = false) List<UUID> branchIds, @AuthenticationPrincipal Jwt jwt) {
        return service.movement(from, to, branchIds, jwt.getClaimAsStringList("branches"));
    }

    /** Phiếu xuất hủy đã hoàn thành trong kỳ, theo hàng (SL đơn vị cơ bản, giá trị theo giá vốn trên phiếu). */
    @GetMapping("/api/reports/inventory/damages")
    public List<DamageRow> damages(@RequestParam Instant from, @RequestParam Instant to,
                                   @RequestParam(required = false) List<UUID> branchIds, @AuthenticationPrincipal Jwt jwt) {
        return service.damages(from, to, branchIds, jwt.getClaimAsStringList("branches"));
    }

    /** Giá trị xuất hủy theo tháng (giờ Việt Nam) — dòng "Xuất hủy hàng hóa" của Báo cáo tài chính. */
    @GetMapping("/api/reports/inventory/damages/monthly")
    public List<MonthValue> damagesMonthly(@RequestParam Instant from, @RequestParam Instant to,
                                           @RequestParam(required = false) List<UUID> branchIds, @AuthenticationPrincipal Jwt jwt) {
        return service.damagesMonthly(from, to, branchIds, jwt.getClaimAsStringList("branches"));
    }
}
