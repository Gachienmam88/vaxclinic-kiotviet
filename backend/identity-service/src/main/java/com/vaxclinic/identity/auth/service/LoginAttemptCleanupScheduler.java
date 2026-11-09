package com.vaxclinic.identity.auth.service;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Dọn bộ đếm đăng nhập sai đã hết tác dụng mỗi phút (xem LoginAttemptLimiter). */
@Component
public class LoginAttemptCleanupScheduler {

    private final LoginAttemptLimiter limiter;

    public LoginAttemptCleanupScheduler(LoginAttemptLimiter limiter) {
        this.limiter = limiter;
    }

    @Scheduled(fixedDelay = 60_000)
    public void cleanup() {
        limiter.cleanup();
    }
}
