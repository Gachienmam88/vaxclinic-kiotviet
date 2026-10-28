package com.vaxclinic.identity.auth.twofactor;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.identity.user.AppUser;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Xác thực 2 lớp bằng ứng dụng Authenticator: tạo khóa (chưa bật) → nhập mã để bật (nhận 10 mã khôi phục) → tắt cần
 * mật khẩu + mã. Đăng nhập của user đã bật phải kèm mã (AuthService). Kiểm tra mã + giới hạn lần thử ở {@link TotpVerifier}.
 */
@Service
public class TwoFactorService {

    public record Status(boolean enabled, boolean pending, int recoveryCodesLeft) {
    }

    /** secret: khóa Base32 để nhập tay; otpauthUrl: nội dung mã QR. */
    public record Setup(String secret, String otpauthUrl) {
    }

    static final int RECOVERY_CODES = 10;

    private final JdbcTemplate jdbc;
    private final TotpSecretCipher cipher;
    private final TotpVerifier verifier;
    private final PasswordEncoder passwordEncoder;

    public TwoFactorService(JdbcTemplate jdbc, TotpSecretCipher cipher, TotpVerifier verifier, PasswordEncoder passwordEncoder) {
        this.jdbc = jdbc;
        this.cipher = cipher;
        this.verifier = verifier;
        this.passwordEncoder = passwordEncoder;
    }

    public boolean enabled(UUID userId) {
        return Boolean.TRUE.equals(jdbc.query("select enabled from user_totp where user_id = ?",
                rs -> rs.next() ? rs.getBoolean(1) : false, userId));
    }

    public Status status(UUID userId) {
        Boolean enabled = jdbc.query("select enabled from user_totp where user_id = ?", rs -> rs.next() ? rs.getBoolean(1) : null, userId);
        Integer left = jdbc.queryForObject("select count(*) from user_recovery_codes where user_id = ? and used_at is null",
                Integer.class, userId);
        return new Status(Boolean.TRUE.equals(enabled), Boolean.FALSE.equals(enabled), left == null ? 0 : left);
    }

    /** Tạo khóa mới (thay khóa đang chờ xác nhận nếu có). issuer: tên hiển thị trong ứng dụng Authenticator. */
    @Transactional
    public Setup setup(AppUser user, String issuer) {
        if (enabled(user.getId())) {
            throw BusinessException.conflict("TOTP_ALREADY_ENABLED", "Xác thực 2 lớp đang bật");
        }
        byte[] secret = TotpAlgorithm.newSecret();
        jdbc.update("""
                insert into user_totp(user_id, secret_enc, enabled) values (?, ?, false)
                on conflict (user_id) do update set secret_enc = excluded.secret_enc, enabled = false, last_step = null,
                  failed_attempts = 0, locked_until = null, created_at = now(), enabled_at = null""",
                user.getId(), cipher.encrypt(secret));
        String b32 = TotpAlgorithm.base32(secret);
        String label = enc(issuer) + ":" + enc(user.getUsername());
        return new Setup(b32, "otpauth://totp/" + label + "?secret=" + b32 + "&issuer=" + enc(issuer)
                + "&algorithm=SHA1&digits=6&period=" + TotpAlgorithm.STEP_SECONDS);
    }

    /** Xác nhận mã đầu tiên → bật 2FA, trả mã khôi phục (chỉ hiện 1 lần). */
    @Transactional
    public List<String> enable(UUID userId, String code) {
        Status s = status(userId);
        if (s.enabled()) {
            throw BusinessException.conflict("TOTP_ALREADY_ENABLED", "Xác thực 2 lớp đang bật");
        }
        if (!s.pending()) {
            throw BusinessException.badRequest("TOTP_NOT_SETUP", "Tạo mã QR trước khi xác nhận");
        }
        verifier.verify(userId, code, false);
        jdbc.update("update user_totp set enabled = true, enabled_at = now() where user_id = ?", userId);
        return newRecoveryCodes(userId);
    }

    @Transactional
    public void disable(AppUser user, String password, String code) {
        requireEnabled(user.getId());
        checkPassword(user, password);
        verifier.verify(user.getId(), code, true);
        jdbc.update("delete from user_recovery_codes where user_id = ?", user.getId());
        jdbc.update("delete from user_totp where user_id = ?", user.getId());
    }

    @Transactional
    public List<String> regenerateRecoveryCodes(AppUser user, String password, String code) {
        requireEnabled(user.getId());
        checkPassword(user, password);
        verifier.verify(user.getId(), code, false);
        return newRecoveryCodes(user.getId());
    }

    /** Đăng nhập: user đã bật 2FA phải có mã đúng (TOTP hoặc mã khôi phục). */
    public void checkLogin(UUID userId, String code) {
        if (code == null || code.isBlank()) {
            throw new BusinessException(HttpStatus.UNAUTHORIZED, "TOTP_REQUIRED", "Nhập mã xác thực 2 lớp từ ứng dụng Authenticator");
        }
        verifier.verify(userId, code, true);
    }

    /**
     * Bước "Xác thực" của thao tác nhạy cảm (đổi tên, bảo lưu, chuyển nhượng...): đã bật 2FA → mã Authenticator,
     * chưa bật → mật khẩu đăng nhập hiện tại. Thay cho OTP SMS (hệ thống không có nhà cung cấp SMS).
     */
    public void confirmIdentity(AppUser user, String password, String code) {
        if (enabled(user.getId())) {
            if (code == null || code.isBlank()) {
                throw BusinessException.badRequest("TOTP_REQUIRED", "Nhập mã xác thực 2 lớp từ ứng dụng Authenticator");
            }
            verifier.verify(user.getId(), code, false);
        } else {
            checkPassword(user, password);
        }
    }

    private void checkPassword(AppUser user, String password) {
        if (password == null || !passwordEncoder.matches(password, user.getPasswordHash())) {
            throw BusinessException.badRequest("BAD_PASSWORD", "Mật khẩu không đúng");
        }
    }

    private void requireEnabled(UUID userId) {
        if (!enabled(userId)) {
            throw BusinessException.badRequest("TOTP_NOT_ENABLED", "Xác thực 2 lớp chưa bật");
        }
    }

    private List<String> newRecoveryCodes(UUID userId) {
        jdbc.update("delete from user_recovery_codes where user_id = ?", userId);
        List<String> codes = new ArrayList<>();
        for (int i = 0; i < RECOVERY_CODES; i++) {
            String raw = TotpAlgorithm.randomToken(10);
            jdbc.update("insert into user_recovery_codes(user_id, code_hash) values (?, ?)", userId, cipher.hashRecovery(raw));
            codes.add(raw.substring(0, 5) + "-" + raw.substring(5));
        }
        return codes;
    }

    private static String enc(String s) {
        return URLEncoder.encode(s, StandardCharsets.UTF_8).replace("+", "%20");
    }
}
