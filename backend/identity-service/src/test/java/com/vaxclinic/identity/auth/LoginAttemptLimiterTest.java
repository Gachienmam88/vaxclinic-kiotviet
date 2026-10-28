package com.vaxclinic.identity.auth;

import com.vaxclinic.common.error.BusinessException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class LoginAttemptLimiterTest {

    /** Đồng hồ chỉnh tay được. */
    private static final class MutableClock extends Clock {
        Instant now = Instant.parse("2026-10-29T08:00:00Z");

        @Override
        public ZoneOffset getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(java.time.ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }

    private final MutableClock clock = new MutableClock();
    private final LoginAttemptLimiter limiter = new LoginAttemptLimiter(clock);

    private void fail(String user, String ip, int times) {
        for (int i = 0; i < times; i++) {
            limiter.recordFailure(user, ip);
        }
    }

    @Test
    void locksAfterFiveFailuresFor5MinutesWithVietnameseMessage() {
        fail("admin", "1.1.1.1", 4);
        assertThatCode(() -> limiter.checkAllowed("admin", "1.1.1.1")).doesNotThrowAnyException();
        fail("admin", "1.1.1.1", 1);
        assertThatThrownBy(() -> limiter.checkAllowed("ADMIN ", "1.1.1.1"))
                .isInstanceOfSatisfying(BusinessException.class, e -> {
                    assertThat(e.getStatus()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
                    assertThat(e.getMessage()).isEqualTo("Đăng nhập sai quá nhiều lần, thử lại sau 5 phút");
                });
        clock.now = clock.now.plus(Duration.ofSeconds(150));
        assertThatThrownBy(() -> limiter.checkAllowed("admin", "1.1.1.1")).hasMessageContaining("thử lại sau 3 phút");
        clock.now = clock.now.plus(Duration.ofSeconds(151));
        assertThatCode(() -> limiter.checkAllowed("admin", "1.1.1.1")).doesNotThrowAnyException();
    }

    @Test
    void lockIsPerUsernameAndIp() {
        fail("admin", "1.1.1.1", 5);
        assertThatCode(() -> limiter.checkAllowed("admin", "2.2.2.2")).doesNotThrowAnyException();
        assertThatCode(() -> limiter.checkAllowed("thungan", "1.1.1.1")).doesNotThrowAnyException();
    }

    @Test
    void successResetsCounter() {
        fail("admin", "1.1.1.1", 4);
        limiter.recordSuccess("admin", "1.1.1.1");
        fail("admin", "1.1.1.1", 4);
        assertThatCode(() -> limiter.checkAllowed("admin", "1.1.1.1")).doesNotThrowAnyException();
    }

    @Test
    void oldFailuresOutsideWindowDoNotCountAndAfterLockCounterRestarts() {
        fail("admin", "1.1.1.1", 4);
        clock.now = clock.now.plus(LoginAttemptLimiter.FAILURE_WINDOW).plusSeconds(1);
        fail("admin", "1.1.1.1", 1);
        assertThatCode(() -> limiter.checkAllowed("admin", "1.1.1.1")).doesNotThrowAnyException();

        fail("admin", "1.1.1.1", 4); // 5 trong cửa sổ → khóa
        clock.now = clock.now.plus(LoginAttemptLimiter.LOCK).plusSeconds(1);
        fail("admin", "1.1.1.1", 1); // hết khóa: đếm lại từ 1
        assertThatCode(() -> limiter.checkAllowed("admin", "1.1.1.1")).doesNotThrowAnyException();
    }

    @Test
    void cleanupRemovesOnlyExpiredEntries() {
        fail("a", "1.1.1.1", 5);
        fail("b", "1.1.1.1", 1);
        limiter.cleanup();
        assertThat(limiter.size()).isEqualTo(2);
        clock.now = clock.now.plus(LoginAttemptLimiter.FAILURE_WINDOW).plusSeconds(1);
        limiter.cleanup();
        assertThat(limiter.size()).isZero();
    }

    @Test
    void clientIpIsLastForwardedEntryAddedByGateway() {
        var req = new MockHttpServletRequest();
        req.setRemoteAddr("127.0.0.1");
        assertThat(ClientIpResolver.resolve(req)).isEqualTo("127.0.0.1");
        req.addHeader("X-Forwarded-For", "6.6.6.6, 10.0.0.5");
        assertThat(ClientIpResolver.resolve(req)).isEqualTo("10.0.0.5");
    }
}
