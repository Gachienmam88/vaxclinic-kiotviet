package com.vaxclinic.common.notification;

import com.vaxclinic.common.security.ServiceTokenProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.UUID;

/**
 * Gửi cảnh báo vào "Hộp thư đến" (identity-service /internal/notifications). Các job cảnh báo ở từng service dùng
 * {@link #sync}: gửi toàn bộ cảnh báo đang đúng của các loại mình phụ trách → identity tạo mới / giữ nguyên (chống trùng
 * theo dedupeKey) và tự đóng các cảnh báo cùng loại không còn trong danh sách. Lỗi gọi HTTP chỉ log cảnh báo
 * (job chạy lại lần sau), không ném ra ngoài.
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

    private final RestClient http;
    private final ServiceTokenProvider tokens;

    public NotificationClient(RestClient http, ServiceTokenProvider tokens) {
        this.http = http;
        this.tokens = tokens;
    }

    /** Đồng bộ trọn bộ cảnh báo của các loại `types`. Trả false nếu không gửi được. */
    public boolean sync(List<String> types, List<Item> items) {
        return post("/internal/notifications/sync", new SyncRequest(types, items), types.toString());
    }

    /** Thêm cảnh báo dạng sự kiện (VD nhận chuyển khoản) — gửi lại cùng dedupeKey không tạo trùng. */
    public boolean publish(List<Item> items) {
        return items.isEmpty() || post("/internal/notifications", items, items.size() + " items");
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
