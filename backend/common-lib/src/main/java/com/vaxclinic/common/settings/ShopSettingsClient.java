package com.vaxclinic.common.settings;

import com.vaxclinic.common.security.ServiceTokenProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Đọc thiết lập từ identity-service /internal/settings, cache 30 giây (đổi thiết lập có hiệu lực sau tối đa 30 giây).
 * identity-service không phản hồi → dùng bản đã đọc gần nhất; chưa đọc được lần nào → mặc định (để quầy vẫn bán được).
 * <ul>
 *   <li>{@link #get()}: cache hết hạn → gọi HTTP ngay trên luồng hiện tại (có timeout của RestClient).</li>
 *   <li>{@link #cached()}: KHÔNG BAO GIỜ gọi HTTP trên luồng hiện tại — trả bản đang có. Lần gọi đầu bật làm mới nền
 *       định kỳ mỗi {@value #POLL_SECONDS} giây, nên bản trong cache cũ tối đa ~{@value #POLL_SECONDS} giây (+ thời gian gọi).
 *       Dùng ở chỗ đang giữ khóa dòng DB (VD StockMovementService) để identity chậm không kéo dài thời gian khóa.</li>
 * </ul>
 */
public class ShopSettingsClient {

    private static final Logger log = LoggerFactory.getLogger(ShopSettingsClient.class);
    private static final Duration TTL = Duration.ofSeconds(30);
    static final long POLL_SECONDS = 10;

    private final RestClient http;
    private final ServiceTokenProvider tokens;
    private final AtomicBoolean refreshing = new AtomicBoolean();
    private final AtomicBoolean polling = new AtomicBoolean();
    private final ScheduledExecutorService refresher = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "shop-settings-refresh");
        t.setDaemon(true);
        return t;
    });
    private volatile ShopSettings cached;
    private volatile Instant fetchedAt = Instant.EPOCH;

    public ShopSettingsClient(RestClient http, ServiceTokenProvider tokens) {
        this.http = http;
        this.tokens = tokens;
    }

    public ShopSettings get() {
        if (fresh()) {
            return cached;
        }
        fetch();
        return cached == null ? ShopSettings.DEFAULT : cached;
    }

    /** Bản thiết lập đang có (không chặn). Hết hạn / chưa có → làm mới nền; chưa đọc được lần nào → mặc định. */
    public ShopSettings cached() {
        startPolling();
        if (!fresh()) {
            refreshAsync();
        }
        ShopSettings current = cached;
        return current == null ? ShopSettings.DEFAULT : current;
    }

    /** Làm mới nền (tối đa 1 lần chạy cùng lúc). Gọi lúc khởi động để {@link #cached()} có dữ liệu thật sớm. */
    public void refreshAsync() {
        startPolling();
        if (refreshing.compareAndSet(false, true)) {
            refresher.execute(() -> {
                try {
                    fetch();
                } finally {
                    refreshing.set(false);
                }
            });
        }
    }

    /** Bật làm mới nền định kỳ (1 lần duy nhất) — chỉ service nào dùng {@link #cached()} mới phát sinh các lần gọi này. */
    private void startPolling() {
        if (polling.compareAndSet(false, true)) {
            refresher.scheduleWithFixedDelay(this::fetch, POLL_SECONDS, POLL_SECONDS, TimeUnit.SECONDS);
        }
    }

    private boolean fresh() {
        return cached != null && Instant.now().isBefore(fetchedAt.plus(TTL));
    }

    private void fetch() {
        try {
            ShopSettings loaded = http.get().uri("/internal/settings")
                    .header("Authorization", "Bearer " + tokens.token()).retrieve().body(ShopSettings.class);
            cached = loaded == null ? ShopSettings.DEFAULT : loaded;
            fetchedAt = Instant.now();
        } catch (RuntimeException e) {
            log.warn("Cannot load shop settings from identity-service: {}", e.getMessage());
        }
    }
}
