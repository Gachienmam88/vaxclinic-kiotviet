package com.vaxclinic.product.report.controller;

import com.vaxclinic.common.error.BusinessException;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.security.oauth2.jwt.Jwt;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Tham số chung báo cáo kho / NCC: khoảng [from, to) + chi nhánh (giới hạn trong chi nhánh người dùng được làm việc). */
final class ProductReportScope {

    private ProductReportScope() {
    }

    static MapSqlParameterSource params(Instant from, Instant to, List<UUID> branchIds, Jwt jwt) {
        if (from == null || to == null || !from.isBefore(to)) {
            throw BusinessException.badRequest("REPORT_RANGE_INVALID", "Khoảng thời gian báo cáo không hợp lệ");
        }
        List<String> claim = jwt.getClaimAsStringList("branches");
        List<UUID> allowed = claim == null ? List.of() : claim.stream().map(UUID::fromString).toList();
        List<UUID> branches = branchIds == null || branchIds.isEmpty() ? allowed : branchIds.stream().filter(allowed::contains).toList();
        return new MapSqlParameterSource().addValue("from", Timestamp.from(from)).addValue("to", Timestamp.from(to))
                // Danh sách rỗng → "in ()" sai cú pháp: thay bằng 1 id giả (không khớp dòng nào)
                .addValue("branches", branches.isEmpty() ? List.of(new UUID(0, 0)) : branches);
    }
}
