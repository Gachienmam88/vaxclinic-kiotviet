package com.vaxclinic.identity.auth.twofactor;

import com.vaxclinic.common.error.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Kiểm tra mã 2 lớp (TOTP 6 số hoặc mã khôi phục) với giới hạn số lần thử: sai {@value #MAX_FAILS} lần liên tiếp →
 * khóa nhập mã {@link #LOCK}. Chạy trong giao dịch riêng (REQUIRES_NEW) để bộ đếm lần sai vẫn được lưu khi giao dịch
 * gọi (đăng nhập, tắt 2FA...) bị hủy do mã sai.
 */
@Component
public class TotpVerifier {

    static final int MAX_FAILS = 5;
    static final Duration LOCK = Duration.ofMinutes(5);

    private final JdbcTemplate jdbc;
    private final TotpSecretCipher cipher;

    public TotpVerifier(JdbcTemplate jdbc, TotpSecretCipher cipher) {
        this.jdbc = jdbc;
        this.cipher = cipher;
    }

    /** allowRecovery: chấp nhận cả mã khôi phục (đăng nhập, tắt 2FA khi mất điện thoại); mã khôi phục dùng xong bị hủy. */
    @Transactional(propagation = Propagation.REQUIRES_NEW, noRollbackFor = BusinessException.class)
    public void verify(UUID userId, String rawCode, boolean allowRecovery) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "select secret_enc, last_step, failed_attempts, locked_until from user_totp where user_id = ? for update", userId);
        if (rows.isEmpty()) {
            throw BusinessException.badRequest("TOTP_NOT_SETUP", "Chưa thiết lập xác thực 2 lớp");
        }
        Map<String, Object> row = rows.get(0);
        Instant now = Instant.now();
        Timestamp lockedUntil = (Timestamp) row.get("locked_until");
        if (lockedUntil != null && lockedUntil.toInstant().isAfter(now)) {
            throw new BusinessException(HttpStatus.TOO_MANY_REQUESTS, "TOTP_LOCKED",
                    "Nhập sai mã quá nhiều lần. Thử lại sau " + Math.max(1, Duration.between(now, lockedUntil.toInstant()).toMinutes() + 1) + " phút");
        }
        String code = rawCode == null ? "" : rawCode.replaceAll("[\\s-]", "").toLowerCase();
        if (code.matches("\\d{6}")) {
            Long last = row.get("last_step") == null ? null : ((Number) row.get("last_step")).longValue();
            long step = TotpAlgorithm.match(cipher.decrypt((String) row.get("secret_enc")), code,
                    TotpAlgorithm.stepOf(now.getEpochSecond()), last);
            if (step >= 0) {
                jdbc.update("update user_totp set last_step = ?, failed_attempts = 0, locked_until = null where user_id = ?", step, userId);
                return;
            }
        } else if (allowRecovery && code.matches("[a-z2-7]{10}")) {
            int used = jdbc.update("update user_recovery_codes set used_at = now() where id = (select id from user_recovery_codes"
                    + " where user_id = ? and code_hash = ? and used_at is null limit 1)", userId, cipher.hashRecovery(code));
            if (used == 1) {
                jdbc.update("update user_totp set failed_attempts = 0, locked_until = null where user_id = ?", userId);
                return;
            }
        }
        int fails = ((Number) row.get("failed_attempts")).intValue() + 1;
        if (fails >= MAX_FAILS) {
            jdbc.update("update user_totp set failed_attempts = 0, locked_until = ? where user_id = ?", Timestamp.from(now.plus(LOCK)), userId);
            throw new BusinessException(HttpStatus.TOO_MANY_REQUESTS, "TOTP_LOCKED",
                    "Nhập sai mã " + MAX_FAILS + " lần. Tạm khóa nhập mã " + LOCK.toMinutes() + " phút");
        }
        jdbc.update("update user_totp set failed_attempts = ? where user_id = ?", fails, userId);
        throw new BusinessException(HttpStatus.UNAUTHORIZED, "TOTP_INVALID",
                "Mã xác thực không đúng hoặc đã hết hạn (còn " + (MAX_FAILS - fails) + " lần thử)");
    }
}
