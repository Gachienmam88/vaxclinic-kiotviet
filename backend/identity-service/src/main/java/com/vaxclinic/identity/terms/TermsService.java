package com.vaxclinic.identity.terms;

import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.common.error.BusinessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Điều khoản sử dụng hệ thống: nội dung ở frontend (features/store-profile/terms-of-use-content.ts), phiên bản hiện hành ở
 * đây. Đổi nội dung → tăng CURRENT_VERSION ở CẢ HAI nơi: mọi user phải đồng ý lại ở lần mở hệ thống kế tiếp.
 */
@Service
public class TermsService {

    public static final String CURRENT_VERSION = "1.0";
    public static final LocalDate EFFECTIVE_DATE = LocalDate.of(2026, 11, 1);

    /** acceptedAt: thời điểm user đồng ý phiên bản hiện hành (null = chưa đồng ý). */
    public record TermsStatus(String version, LocalDate effectiveDate, Instant acceptedAt) {
    }

    private final TermsAcceptanceRepository acceptances;
    private final AuditLogger audit;

    public TermsService(TermsAcceptanceRepository acceptances, AuditLogger audit) {
        this.acceptances = acceptances;
        this.audit = audit;
    }

    public TermsStatus status(UUID userId) {
        return new TermsStatus(CURRENT_VERSION, EFFECTIVE_DATE, acceptances.findAcceptedAt(userId, CURRENT_VERSION).orElse(null));
    }

    /** Chỉ nhận đồng ý cho phiên bản hiện hành (màn hình cũ gửi bản cũ → yêu cầu tải lại). */
    @Transactional
    public TermsStatus accept(UUID userId, String userName, String version) {
        if (!CURRENT_VERSION.equals(version)) {
            throw BusinessException.badRequest("TERMS_VERSION", "Điều khoản đã có phiên bản mới. Tải lại trang để đọc bản mới nhất");
        }
        if (acceptances.insertIfAbsent(userId, CURRENT_VERSION)) {
            audit.record(userId, userName, null, "Tài khoản", "Đồng ý", null, "Đồng ý Điều khoản sử dụng phiên bản " + CURRENT_VERSION);
        }
        return status(userId);
    }
}
