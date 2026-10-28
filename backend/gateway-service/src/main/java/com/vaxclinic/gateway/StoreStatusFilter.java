package com.vaxclinic.gateway;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;

/**
 * Áp trạng thái gian hàng (identity-service /api/auth/store-status, cache {@link #TTL}) cho mọi request qua gateway:
 * - JWT phát hành trước mốc sessionsNotBefore (đổi tên gian hàng) → 401, BFF refresh thất bại → về trang đăng nhập;
 * - đang bảo lưu → 423 "Gian hàng đang bảo lưu", trừ /api/auth/** (đăng nhập, tài khoản), /api/store-profile/**
 *   (xem hồ sơ, mở lại sớm) và GET /api/settings/** (đọc thiết lập).
 * identity-service không trả lời → dùng trạng thái đọc được gần nhất (chưa có → coi như đang hoạt động).
 */
@Component
public class StoreStatusFilter implements GlobalFilter, Ordered {

    record StoreStatus(boolean paused, String reopenOn, boolean pauseUsed, long sessionsNotBefore) {
    }

    private static final Logger log = LoggerFactory.getLogger(StoreStatusFilter.class);
    private static final Duration TTL = Duration.ofSeconds(5);
    private static final StoreStatus OPEN = new StoreStatus(false, null, false, 0);

    private final WebClient http;
    private volatile StoreStatus cached;
    private volatile Instant fetchedAt = Instant.EPOCH;

    public StoreStatusFilter(WebClient.Builder builder, @Value("${IDENTITY_URL:http://localhost:8081}") String identityUrl) {
        this.http = builder.baseUrl(identityUrl).build();
    }

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String path = exchange.getRequest().getPath().value();
        return status().flatMap(s -> exchange.getPrincipal().map(p -> p instanceof JwtAuthenticationToken t
                                && s.sessionsNotBefore() > 0 && t.getToken().getIssuedAt() != null
                                && t.getToken().getIssuedAt().getEpochSecond() < s.sessionsNotBefore())
                        .defaultIfEmpty(false)
                        .flatMap(expired -> {
                            if (expired) {
                                return reject(exchange, HttpStatus.UNAUTHORIZED, "SESSION_REVOKED",
                                        "Phiên đăng nhập đã hết hiệu lực. Vui lòng đăng nhập lại");
                            }
                            if (s.paused() && !allowedWhilePaused(path, exchange.getRequest().getMethod())) {
                                return reject(exchange, HttpStatus.LOCKED, "STORE_PAUSED", "Gian hàng đang bảo lưu");
                            }
                            return chain.filter(exchange);
                        }));
    }

    static boolean allowedWhilePaused(String path, HttpMethod method) {
        return !path.startsWith("/api/") || path.startsWith("/api/auth/") || path.startsWith("/api/store-profile")
                || (HttpMethod.GET.equals(method) && path.startsWith("/api/settings"));
    }

    private Mono<StoreStatus> status() {
        StoreStatus c = cached;
        if (c != null && Instant.now().isBefore(fetchedAt.plus(TTL))) {
            return Mono.just(c);
        }
        return http.get().uri("/api/auth/store-status").retrieve().bodyToMono(StoreStatus.class)
                .timeout(Duration.ofSeconds(2))
                .doOnNext(s -> {
                    cached = s;
                    fetchedAt = Instant.now();
                })
                .onErrorResume(e -> {
                    log.warn("Cannot load store status from identity-service: {}", e.getMessage());
                    return Mono.just(c != null ? c : OPEN);
                })
                .defaultIfEmpty(c != null ? c : OPEN);
    }

    private static Mono<Void> reject(ServerWebExchange exchange, HttpStatus status, String code, String message) {
        var res = exchange.getResponse();
        res.setStatusCode(status);
        res.getHeaders().setContentType(MediaType.APPLICATION_JSON);
        String body = "{\"code\":\"" + code + "\",\"message\":\"" + message + "\",\"details\":[],\"timestamp\":\"" + Instant.now() + "\"}";
        return res.writeWith(Mono.just(res.bufferFactory().wrap(body.getBytes(StandardCharsets.UTF_8))));
    }
}
