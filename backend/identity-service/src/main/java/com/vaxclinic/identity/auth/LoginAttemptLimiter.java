package com.vaxclinic.identity.auth;

import com.vaxclinic.common.error.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Giới hạn đăng nhập sai mật khẩu theo (tên đăng nhập, IP): sai {@value #MAX_FAILURES} lần (trong
 * {@link #FAILURE_WINDOW}) → khóa {@link #LOCK}; trong thời gian khóa mọi lần thử (kể cả đúng mật khẩu) trả 429.
 * Đăng nhập thành công xóa bộ đếm. Mã 2FA sai có giới hạn riêng (TotpVerifier); thiếu mã 2FA (TOTP_REQUIRED) không
 * tính là sai.
 * <p>Lưu trong RAM (1 instance identity-service là đủ ở quy mô hiện tại): khởi động lại → bộ đếm về 0; chạy nhiều
 * instance → mỗi instance đếm riêng (giới hạn thực tế = N × số instance) — khi đó chuyển sang bảng DB / Redis.
 * Bản ghi hết tác dụng được dọn định kỳ ({@link LoginAttemptCleanupScheduler}) để RAM không tăng mãi.
 */
@Component
public class LoginAttemptLimiter {

    static final int MAX_FAILURES = 5;
    static final Duration LOCK = Duration.ofMinutes(5);
    static final Duration FAILURE_WINDOW = Duration.ofMinutes(15);

    private record State(int failures, Instant lastFailure, Instant lockedUntil) {
    }

    private final Map<String, State> states = new ConcurrentHashMap<>();
    private final Clock clock;

    public LoginAttemptLimiter() {
        this(Clock.systemUTC());
    }

    LoginAttemptLimiter(Clock clock) {
        this.clock = clock;
    }

    /** Đang bị khóa → 429 "Đăng nhập sai quá nhiều lần, thử lại sau X phút". */
    public void checkAllowed(String username, String ip) {
        State s = states.get(key(username, ip));
        Instant now = clock.instant();
        if (s != null && s.lockedUntil() != null && s.lockedUntil().isAfter(now)) {
            long minutes = Math.max(1, (Duration.between(now, s.lockedUntil()).getSeconds() + 59) / 60);
            throw new BusinessException(HttpStatus.TOO_MANY_REQUESTS, "LOGIN_RATE_LIMITED",
                    "Đăng nhập sai quá nhiều lần, thử lại sau " + minutes + " phút");
        }
    }

    public void recordFailure(String username, String ip) {
        Instant now = clock.instant();
        states.compute(key(username, ip), (k, s) -> {
            boolean restart = s == null || s.lastFailure().isBefore(now.minus(FAILURE_WINDOW))
                    || (s.lockedUntil() != null && !s.lockedUntil().isAfter(now));
            int failures = (restart ? 0 : s.failures()) + 1;
            return failures >= MAX_FAILURES ? new State(0, now, now.plus(LOCK)) : new State(failures, now, null);
        });
    }

    public void recordSuccess(String username, String ip) {
        states.remove(key(username, ip));
    }

    /** Xóa bản ghi không còn tác dụng: hết khóa và lần sai cuối đã ngoài cửa sổ đếm. */
    public void cleanup() {
        Instant now = clock.instant();
        states.values().removeIf(s -> (s.lockedUntil() == null || !s.lockedUntil().isAfter(now))
                && s.lastFailure().isBefore(now.minus(FAILURE_WINDOW)));
    }

    int size() {
        return states.size();
    }

    private static String key(String username, String ip) {
        return username.trim().toLowerCase(Locale.ROOT) + "|" + ip;
    }
}
