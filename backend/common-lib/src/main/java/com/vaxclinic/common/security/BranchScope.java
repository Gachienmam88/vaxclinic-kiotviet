package com.vaxclinic.common.security;

import com.vaxclinic.common.error.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

/**
 * Phạm vi chi nhánh của người dùng cho danh sách / báo cáo: claim "branches" của JWT (các chi nhánh được gán ở Quản lý người
 * dùng; gán đủ mọi chi nhánh = xem toàn cửa hàng). Dữ liệu ngoài phạm vi không hiện; hỏi đích danh chi nhánh ngoài phạm vi
 * → 403 BRANCH_FORBIDDEN. Danh sách trả về không bao giờ rỗng (user không có chi nhánh → 1 id giả, khớp không dòng nào) để
 * dùng thẳng trong "branch_id in (:branches)".
 */
public final class BranchScope {

    private static final UUID NONE = new UUID(0, 0);

    private BranchScope() {
    }

    /** Chi nhánh được xem (không rỗng). */
    public static List<UUID> allowed(Jwt jwt) {
        return allowed(jwt == null ? null : jwt.getClaimAsStringList("branches"));
    }

    /** Như {@link #allowed(Jwt)} nhưng từ danh sách claim "branches" đã đọc sẵn (Actor của từng service). */
    public static List<UUID> allowed(Collection<String> claim) {
        List<UUID> ids = claim == null ? List.of() : claim.stream().map(UUID::fromString).toList();
        return ids.isEmpty() ? List.of(NONE) : ids;
    }

    /** 1 chi nhánh lọc (có thể null = mọi chi nhánh được xem): ngoài phạm vi → 403. Trả về phạm vi chi nhánh để lọc SQL. */
    public static List<UUID> check(Jwt jwt, UUID requested) {
        List<UUID> allowed = allowed(jwt);
        if (requested != null && !allowed.contains(requested)) {
            throw forbidden();
        }
        return allowed;
    }

    /** Nhiều chi nhánh lọc: rỗng = mọi chi nhánh được xem; có chi nhánh ngoài phạm vi → 403; ngược lại đúng danh sách hỏi. */
    public static List<UUID> resolve(Jwt jwt, Collection<UUID> requested) {
        return resolve(jwt == null ? null : jwt.getClaimAsStringList("branches"), requested);
    }

    /** Như {@link #resolve(Jwt, Collection)} với claim "branches" đã đọc sẵn. */
    public static List<UUID> resolve(Collection<String> claim, Collection<UUID> requested) {
        List<UUID> allowed = allowed(claim);
        if (requested == null || requested.isEmpty()) {
            return allowed;
        }
        if (!allowed.containsAll(requested)) {
            throw forbidden();
        }
        return List.copyOf(requested);
    }

    private static BusinessException forbidden() {
        return new BusinessException(HttpStatus.FORBIDDEN, "BRANCH_FORBIDDEN", "Bạn không được xem dữ liệu của chi nhánh này");
    }
}
