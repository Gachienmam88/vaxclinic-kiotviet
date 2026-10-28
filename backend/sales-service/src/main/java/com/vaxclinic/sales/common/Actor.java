package com.vaxclinic.sales.common;

import com.vaxclinic.common.error.BusinessException;
import org.springframework.security.oauth2.jwt.Jwt;

import java.util.List;
import java.util.UUID;

/** Người dùng đang thao tác, lấy từ JWT (id, họ tên, các điểm tiêm được làm việc). */
public record Actor(UUID id, String name, List<String> branchIds) {

    public static Actor of(Jwt jwt) {
        List<String> branches = jwt.getClaimAsStringList("branches");
        return new Actor(UUID.fromString(jwt.getSubject()), jwt.getClaimAsString("name"),
                branches == null ? List.of() : branches);
    }

    public void checkBranch(UUID branchId) {
        if (branchId == null || !branchIds.contains(branchId.toString())) {
            throw BusinessException.badRequest("BRANCH_NOT_ALLOWED", "Bạn không làm việc tại điểm tiêm này");
        }
    }

    public static String blankToNull(String v) {
        return v == null || v.isBlank() ? null : v.trim();
    }
}
