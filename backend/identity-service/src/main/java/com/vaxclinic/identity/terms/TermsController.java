package com.vaxclinic.identity.terms;

import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.common.error.BusinessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Điều khoản sử dụng hệ thống: nội dung ở frontend (features/store-profile/terms-of-use-content.tsx), phiên bản hiện hành ở
 * đây. Đổi nội dung → tăng CURRENT_VERSION ở CẢ HAI nơi: mọi user phải đồng ý lại ở lần mở hệ thống kế tiếp.
 */
@RestController
public class TermsController {

    public static final String CURRENT_VERSION = "1.0";
    public static final LocalDate EFFECTIVE_DATE = LocalDate.of(2026, 11, 1);

    /** acceptedAt: thời điểm user đồng ý phiên bản hiện hành (null = chưa đồng ý). */
    public record TermsStatus(String version, LocalDate effectiveDate, Instant acceptedAt) {
    }

    public record AcceptRequest(String version) {
    }

    private final JdbcTemplate jdbc;
    private final AuditLogger audit;

    public TermsController(JdbcTemplate jdbc, AuditLogger audit) {
        this.jdbc = jdbc;
        this.audit = audit;
    }

    @GetMapping("/api/auth/terms")
    public TermsStatus status(@AuthenticationPrincipal Jwt jwt) {
        List<Timestamp> at = jdbc.queryForList("select accepted_at from terms_acceptances where user_id = ? and version = ?",
                Timestamp.class, UUID.fromString(jwt.getSubject()), CURRENT_VERSION);
        return new TermsStatus(CURRENT_VERSION, EFFECTIVE_DATE, at.isEmpty() ? null : at.get(0).toInstant());
    }

    @PostMapping("/api/auth/terms/accept")
    public TermsStatus accept(@RequestBody AcceptRequest req, @AuthenticationPrincipal Jwt jwt) {
        if (!CURRENT_VERSION.equals(req.version())) {
            throw BusinessException.badRequest("TERMS_VERSION", "Điều khoản đã có phiên bản mới. Tải lại trang để đọc bản mới nhất");
        }
        UUID userId = UUID.fromString(jwt.getSubject());
        int n = jdbc.update("insert into terms_acceptances(user_id, version) values (?, ?) on conflict do nothing", userId, CURRENT_VERSION);
        if (n > 0) {
            audit.record(userId, jwt.getClaimAsString("name"), null, "Tài khoản", "Đồng ý", null,
                    "Đồng ý Điều khoản sử dụng phiên bản " + CURRENT_VERSION);
        }
        return status(jwt);
    }
}
