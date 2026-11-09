package com.vaxclinic.identity.auth.twofactor.service;

import com.vaxclinic.identity.auth.twofactor.repository.RecoveryCodeRepository;
import com.vaxclinic.identity.auth.twofactor.repository.UserTotpRepository;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.identity.auth.twofactor.repository.UserTotpRepository.TotpRow;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

/**
 * Kiểm tra mã 2 lớp (TOTP 6 số hoặc mã khôi phục) với giới hạn số lần thử: sai {@value #MAX_FAILS} lần liên tiếp →
 * khóa nhập mã {@link #LOCK}. Chạy trong giao dịch riêng (REQUIRES_NEW) để bộ đếm lần sai vẫn được lưu khi giao dịch
 * gọi (đăng nhập, tắt 2FA...) bị hủy do mã sai. Mã sai trả 400 (không phải 401) để BFF không tự refresh rồi gửi lại.
 */
@Service
public class TotpVerifier {

    static final int MAX_FAILS = 5;
    static final Duration LOCK = Duration.ofMinutes(5);

    private final UserTotpRepository totp;
    private final RecoveryCodeRepository recoveryCodes;
    private final TotpSecretCipher cipher;

    public TotpVerifier(UserTotpRepository totp, RecoveryCodeRepository recoveryCodes, TotpSecretCipher cipher) {
        this.totp = totp;
        this.recoveryCodes = recoveryCodes;
        this.cipher = cipher;
    }

    /** allowRecovery: chấp nhận cả mã khôi phục (đăng nhập, tắt 2FA khi mất điện thoại); mã khôi phục dùng xong bị hủy. */
    @Transactional(propagation = Propagation.REQUIRES_NEW, noRollbackFor = BusinessException.class)
    public void verify(UUID userId, String rawCode, boolean allowRecovery) {
        TotpRow row = totp.findForUpdate(userId)
                .orElseThrow(() -> BusinessException.badRequest("TOTP_NOT_SETUP", "Chưa thiết lập xác thực 2 lớp"));
        Instant now = Instant.now();
        if (row.lockedUntil() != null && row.lockedUntil().isAfter(now)) {
            throw new BusinessException(HttpStatus.TOO_MANY_REQUESTS, "TOTP_LOCKED",
                    "Nhập sai mã quá nhiều lần. Thử lại sau " + Math.max(1, Duration.between(now, row.lockedUntil()).toMinutes() + 1) + " phút");
        }
        String code = rawCode == null ? "" : rawCode.replaceAll("[\\s-]", "").toLowerCase();
        if (code.matches("\\d{6}")) {
            long step = TotpAlgorithm.match(cipher.decrypt(row.secretEnc()), code, TotpAlgorithm.stepOf(now.getEpochSecond()), row.lastStep());
            if (step >= 0) {
                totp.recordSuccess(userId, step);
                return;
            }
        } else if (allowRecovery && code.matches("[a-z2-7]{10}") && recoveryCodes.consume(userId, cipher.hashRecovery(code))) {
            totp.recordSuccess(userId, null);
            return;
        }
        int fails = row.failedAttempts() + 1;
        if (fails >= MAX_FAILS) {
            totp.recordFailure(userId, 0, now.plus(LOCK));
            throw new BusinessException(HttpStatus.TOO_MANY_REQUESTS, "TOTP_LOCKED",
                    "Nhập sai mã " + MAX_FAILS + " lần. Tạm khóa nhập mã " + LOCK.toMinutes() + " phút");
        }
        totp.recordFailure(userId, fails, null);
        throw new BusinessException(HttpStatus.BAD_REQUEST, "TOTP_INVALID",
                "Mã xác thực không đúng hoặc đã hết hạn (còn " + (MAX_FAILS - fails) + " lần thử)");
    }
}
