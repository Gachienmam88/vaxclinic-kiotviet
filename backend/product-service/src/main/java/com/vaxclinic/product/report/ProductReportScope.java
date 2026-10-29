package com.vaxclinic.product.report;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.common.security.BranchScope;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Tham số chung báo cáo kho / NCC: khoảng [from, to) + chi nhánh (giới hạn trong chi nhánh người dùng được làm việc,
 * claim "branches" của JWT — null = không có chi nhánh nào).
 */
final class ProductReportScope {

    private ProductReportScope() {
    }

    static MapSqlParameterSource params(Instant from, Instant to, List<UUID> branchIds, List<String> branchClaim) {
        if (from == null || to == null || !from.isBefore(to)) {
            throw BusinessException.badRequest("REPORT_RANGE_INVALID", "Khoảng thời gian báo cáo không hợp lệ");
        }
        List<UUID> branches = BranchScope.resolve(branchClaim, branchIds); // ngoài phạm vi → 403 BRANCH_FORBIDDEN
        return new MapSqlParameterSource().addValue("from", Timestamp.from(from)).addValue("to", Timestamp.from(to))
                .addValue("branches", branches);
    }
}
