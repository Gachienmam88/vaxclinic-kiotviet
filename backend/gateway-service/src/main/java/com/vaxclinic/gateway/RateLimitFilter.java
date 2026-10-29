package com.vaxclinic.gateway;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Giới hạn tần suất request tại gateway (token bucket trong RAM, mỗi instance đếm riêng), vượt → 429 RATE_LIMITED + Retry-After.
 * Ba nhóm, mỗi nhóm có bucket riêng theo khóa:
 * - AUTH: POST /api/auth/login, /api/auth/2fa/** (đoán mật khẩu / mã 2FA) — theo IP người dùng, chặt nhất;
 * - REFRESH: /api/auth/refresh, /api/auth/logout — theo IP;
 * - GENERAL: mọi request còn lại — theo user (JWT sub) nếu đã đăng nhập, ngược lại theo IP; rộng rãi cho app nội bộ.
 * IP người dùng: phần tử đầu X-Forwarded-For do BFF Next.js gắn, CHỈ tin khi request tới từ loopback / mạng nội bộ
 * (BFF); gọi thẳng gateway từ ngoài thì dùng địa chỉ TCP.
 */
@Component
public class RateLimitFilter implements GlobalFilter, Ordered {

    enum Group { AUTH, REFRESH, GENERAL }

    private static final long SWEEP_EVERY_NANOS = 60_000_000_000L;
    private static final long IDLE_NANOS = 10 * 60_000_000_000L;

    private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();
    private final AtomicLong lastSweep = new AtomicLong(System.nanoTime());
    private final int authPerMinute;
    private final int refreshPerMinute;
    private final int generalPerMinute;

    public RateLimitFilter(@Value("${app.rate-limit.auth-per-minute:20}") int authPerMinute,
                           @Value("${app.rate-limit.refresh-per-minute:60}") int refreshPerMinute,
                           @Value("${app.rate-limit.general-per-minute:900}") int generalPerMinute) {
        this.authPerMinute = authPerMinute;
        this.refreshPerMinute = refreshPerMinute;
        this.generalPerMinute = generalPerMinute;
    }

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE; // trước StoreStatusFilter: từ chối rẻ, không gọi identity
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest req = exchange.getRequest();
        Group group = groupOf(req.getPath().value());
        Mono<String> key = group == Group.GENERAL
                ? exchange.getPrincipal().map(p -> p instanceof JwtAuthenticationToken t ? "u:" + t.getName() : "ip:" + clientIp(req))
                    .defaultIfEmpty("ip:" + clientIp(req))
                : Mono.just("ip:" + clientIp(req));
        return key.flatMap(k -> {
            long waitSeconds = take(group + "|" + k, limitOf(group));
            return waitSeconds == 0 ? chain.filter(exchange) : reject(exchange, waitSeconds);
        });
    }

    static Group groupOf(String path) {
        if (path.equals("/api/auth/login") || path.startsWith("/api/auth/2fa")) {
            return Group.AUTH;
        }
        if (path.equals("/api/auth/refresh") || path.equals("/api/auth/logout")) {
            return Group.REFRESH;
        }
        return Group.GENERAL;
    }

    private int limitOf(Group g) {
        return switch (g) {
            case AUTH -> authPerMinute;
            case REFRESH -> refreshPerMinute;
            case GENERAL -> generalPerMinute;
        };
    }

    static String clientIp(ServerHttpRequest req) {
        InetSocketAddress remote = req.getRemoteAddress();
        InetAddress addr = remote == null ? null : remote.getAddress();
        String forwarded = req.getHeaders().getFirst("X-Forwarded-For");
        boolean trusted = addr != null && (addr.isLoopbackAddress() || addr.isSiteLocalAddress());
        if (trusted && forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return addr == null ? "unknown" : addr.getHostAddress();
    }

    /** 0 = cho qua; > 0 = số giây chờ tới khi có lại 1 lượt. */
    private long take(String key, int perMinute) {
        long now = System.nanoTime();
        sweep(now);
        return buckets.computeIfAbsent(key, k -> new Bucket(perMinute, now)).take(perMinute, now);
    }

    /** Dọn bucket không dùng > 10 phút, tối đa 1 lần / phút. */
    private void sweep(long now) {
        long last = lastSweep.get();
        if (now - last > SWEEP_EVERY_NANOS && lastSweep.compareAndSet(last, now)) {
            buckets.entrySet().removeIf(e -> now - e.getValue().lastNanos > IDLE_NANOS);
        }
    }

    private static Mono<Void> reject(ServerWebExchange exchange, long waitSeconds) {
        var res = exchange.getResponse();
        res.setStatusCode(HttpStatus.TOO_MANY_REQUESTS);
        res.getHeaders().setContentType(MediaType.APPLICATION_JSON);
        res.getHeaders().set("Retry-After", Long.toString(waitSeconds));
        String body = "{\"code\":\"RATE_LIMITED\",\"message\":\"Bạn thao tác quá nhanh, vui lòng thử lại sau " + waitSeconds
                + " giây\",\"details\":[],\"timestamp\":\"" + Instant.now() + "\"}";
        return res.writeWith(Mono.just(res.bufferFactory().wrap(body.getBytes(StandardCharsets.UTF_8))));
    }

    /** Token bucket: sức chứa = perMinute lượt, nạp lại đều perMinute lượt / 60 giây. */
    private static final class Bucket {
        private double tokens;
        private volatile long lastNanos;

        Bucket(int capacity, long now) {
            this.tokens = capacity;
            this.lastNanos = now;
        }

        synchronized long take(int perMinute, long now) {
            double perNano = perMinute / 60_000_000_000d;
            tokens = Math.min(perMinute, tokens + (now - lastNanos) * perNano);
            lastNanos = now;
            if (tokens >= 1) {
                tokens -= 1;
                return 0;
            }
            return Math.max(1, (long) Math.ceil((1 - tokens) / perNano / 1_000_000_000d));
        }
    }
}
