package com.vaxclinic.common.settings;

import com.vaxclinic.common.security.ServiceTokenProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.time.Instant;

/**
 * Đọc thiết lập từ identity-service /internal/settings, cache 30 giây (đổi thiết lập có hiệu lực sau tối đa 30 giây).
 * identity-service không phản hồi → dùng bản đã đọc gần nhất; chưa đọc được lần nào → mặc định (để quầy vẫn bán được).
 */
public class ShopSettingsClient {

    private static final Logger log = LoggerFactory.getLogger(ShopSettingsClient.class);
    private static final Duration TTL = Duration.ofSeconds(30);

    private final RestClient http;
    private final ServiceTokenProvider tokens;
    private volatile ShopSettings cached;
    private volatile Instant fetchedAt = Instant.EPOCH;

    public ShopSettingsClient(String identityUrl, ServiceTokenProvider tokens) {
        this.http = RestClient.builder().baseUrl(identityUrl).build();
        this.tokens = tokens;
    }

    public ShopSettings get() {
        if (cached != null && Instant.now().isBefore(fetchedAt.plus(TTL))) {
            return cached;
        }
        try {
            ShopSettings fresh = http.get().uri("/internal/settings")
                    .header("Authorization", "Bearer " + tokens.token()).retrieve().body(ShopSettings.class);
            cached = fresh == null ? ShopSettings.DEFAULT : fresh;
            fetchedAt = Instant.now();
        } catch (RuntimeException e) {
            log.warn("Cannot load shop settings from identity-service: {}", e.getMessage());
            if (cached == null) {
                return ShopSettings.DEFAULT;
            }
        }
        return cached;
    }
}
