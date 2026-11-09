package com.vaxclinic.common.notification;

import com.vaxclinic.common.events.EventEnvelope;
import com.vaxclinic.common.security.ServiceTokenProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

/**
 * Gửi cảnh báo vào "Hộp thư đến" (identity-service /internal/notifications). Các job cảnh báo ở từng service dùng
 * {@link #sync}: gửi toàn bộ cảnh báo đang đúng của các loại mình phụ trách → identity tạo mới / giữ nguyên (chống trùng
 * theo dedupeKey) và tự đóng các cảnh báo cùng loại không còn trong danh sách. Lỗi gọi HTTP chỉ log cảnh báo
 * (job chạy lại lần sau), không ném ra ngoài.
 * <p>
 * Kênh gửi: HTTP (mặc định) hoặc Kafka topic {@value #TOPIC} khi có {@code kafka} (app.notification.transport=kafka):
 * chờ Kafka xác nhận (tối đa 3 giây), lỗi thì gửi HTTP như cũ. Mọi bản tin chung 1 key → identity xử lý đúng thứ tự gửi.
 */
public class NotificationClient {

    private static final Logger log = LoggerFactory.getLogger(NotificationClient.class);

    /**
     * Một cảnh báo. dedupeKey: định danh đối tượng (VD "low-stock:{productId}:{branchId}"); docCode: mã chứng từ / hàng
     * để giao diện dựng link; link: đường dẫn cụ thể (ưu tiên hơn docCode); branchId null = mọi chi nhánh;
     * permission: quyền cần có để thấy (null = mọi người).
     */
    public record Item(String type, String dedupeKey, String title, String body, String docCode, String link,
                       UUID branchId, String permission) {
    }

    /** Thiết lập cảnh báo (Thiết lập → Thông báo nội bộ). */
    public record Settings(int expiryAlertDays) {
        public static final Settings DEFAULT = new Settings(30);
    }

    public record SyncRequest(List<String> types, List<Item> items) {
    }

    public static final String TOPIC = "notification.events";
    public static final String TYPE_PUBLISH = "notification.publish";
    public static final String TYPE_SYNC = "notification.sync";

    /** Nội dung bản tin notification.publish. */
    public record PublishRequest(List<Item> items) {
    }

    private final RestClient http;
    private final ServiceTokenProvider tokens;
    private final KafkaTemplate<String, String> kafka;
    private final String source;

    public NotificationClient(RestClient http, ServiceTokenProvider tokens) {
        this(http, tokens, null, null);
    }

    /** kafka null = chỉ HTTP. */
    public NotificationClient(RestClient http, ServiceTokenProvider tokens, KafkaTemplate<String, String> kafka, String source) {
        this.http = http;
        this.tokens = tokens;
        this.kafka = kafka;
        this.source = source;
    }

    /** Đồng bộ trọn bộ cảnh báo của các loại `types`. Trả false nếu không gửi được. */
    public boolean sync(List<String> types, List<Item> items) {
        var req = new SyncRequest(types, items);
        return viaKafka(TYPE_SYNC, req, types.toString()) || post("/internal/notifications/sync", req, types.toString());
    }

    /** Thêm cảnh báo dạng sự kiện (VD nhận chuyển khoản) — gửi lại cùng dedupeKey không tạo trùng. */
    public boolean publish(List<Item> items) {
        return items.isEmpty() || viaKafka(TYPE_PUBLISH, new PublishRequest(items), items.size() + " items")
                || post("/internal/notifications", items, items.size() + " items");
    }

    public Settings settings() {
        try {
            Settings s = http.get().uri("/internal/notifications/settings")
                    .header("Authorization", "Bearer " + tokens.token()).retrieve().body(Settings.class);
            return s == null ? Settings.DEFAULT : s;
        } catch (RuntimeException e) {
            log.warn("Cannot load notification settings: {}", e.getMessage());
            return Settings.DEFAULT;
        }
    }

    private boolean viaKafka(String type, Object data, String what) {
        if (kafka == null) {
            return false;
        }
        try {
            kafka.send(TOPIC, "notifications", EventEnvelope.of(type, source, data).toJson()).get(3, TimeUnit.SECONDS);
            return true;
        } catch (Exception e) {
            log.warn("Kafka notification send failed ({}), falling back to HTTP: {}", what, e.getMessage());
            return false;
        }
    }

    /** Đóng producer Kafka (gọi khi tắt service). */
    public void close() {
        if (kafka != null) {
            kafka.getProducerFactory().reset();
        }
    }

    private boolean post(String path, Object body, String what) {
        try {
            http.post().uri(path).header("Authorization", "Bearer " + tokens.token()).body(body).retrieve().toBodilessEntity();
            return true;
        } catch (RuntimeException e) {
            log.warn("Cannot send notifications {}: {}", what, e.getMessage());
            return false;
        }
    }
}
