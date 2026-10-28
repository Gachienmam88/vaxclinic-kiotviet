package com.vaxclinic.identity.notification;

import com.vaxclinic.common.notification.NotificationClient.Item;
import com.vaxclinic.common.notification.NotificationClient.Settings;
import com.vaxclinic.common.notification.NotificationClient.SyncRequest;
import com.vaxclinic.common.web.PageResponse;
import com.vaxclinic.identity.notification.NotificationReader.NotificationItem;
import com.vaxclinic.identity.notification.NotificationReader.UnreadCount;
import com.vaxclinic.identity.settings.SettingsStore;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Hộp thư đến (chuông trên thanh trên cùng): mọi user đăng nhập đọc hộp thư của mình. Các service gửi cảnh báo qua
 * /internal/notifications (JWT nội bộ, không đi qua gateway). Thiết lập cảnh báo lưu ở app_settings khóa "notification".
 */
@RestController
public class NotificationController {

    public record SettingsRequest(@Min(1) @Max(365) int expiryAlertDays) {
    }

    private final NotificationReader reader;
    private final NotificationWriter writer;
    private final SettingsStore store;

    public NotificationController(NotificationReader reader, NotificationWriter writer, SettingsStore store) {
        this.reader = reader;
        this.writer = writer;
        this.store = store;
    }

    @GetMapping("/api/notifications")
    public PageResponse<NotificationItem> list(@RequestParam(defaultValue = "all") String tab,
                                               @RequestParam(defaultValue = "0") int page,
                                               @RequestParam(defaultValue = "20") int size, @AuthenticationPrincipal Jwt jwt) {
        return reader.list(NotificationViewer.of(jwt), tab, page, size);
    }

    @GetMapping("/api/notifications/unread-count")
    public UnreadCount unread(@AuthenticationPrincipal Jwt jwt) {
        return reader.unread(NotificationViewer.of(jwt));
    }

    @PostMapping("/api/notifications/{id}/read")
    public void read(@PathVariable long id, @AuthenticationPrincipal Jwt jwt) {
        reader.markRead(NotificationViewer.of(jwt), id);
    }

    @PostMapping("/api/notifications/read-all")
    public Map<String, Integer> readAll(@RequestParam(defaultValue = "all") String tab, @AuthenticationPrincipal Jwt jwt) {
        return Map.of("marked", reader.markAllRead(NotificationViewer.of(jwt), tab));
    }

    @GetMapping("/api/notifications/settings")
    public Settings settings() {
        Settings s = store.read("notification", Settings.class);
        return s == null ? Settings.DEFAULT : s;
    }

    @PutMapping("/api/notifications/settings")
    @PreAuthorize("hasAuthority('settings.manage')")
    public Settings saveSettings(@Valid @RequestBody SettingsRequest req, @AuthenticationPrincipal Jwt jwt) {
        store.write("notification", new Settings(req.expiryAlertDays()), UUID.fromString(jwt.getSubject()));
        return settings();
    }

    // ===== Nội bộ: các service gửi cảnh báo =====

    @GetMapping("/internal/notifications/settings")
    @PreAuthorize("hasAuthority('internal')")
    public Settings internalSettings() {
        return settings();
    }

    /** Cảnh báo dạng sự kiện; gửi lại cùng dedupeKey không tạo trùng. */
    @PostMapping("/internal/notifications")
    @PreAuthorize("hasAuthority('internal')")
    public void publish(@RequestBody List<Item> items) {
        writer.upsert(items);
    }

    /** Trọn bộ cảnh báo đang đúng của các loại `types`; cảnh báo cùng loại không còn trong danh sách bị đóng. */
    @PostMapping("/internal/notifications/sync")
    @PreAuthorize("hasAuthority('internal')")
    public void sync(@RequestBody SyncRequest req) {
        if (req.types() != null && !req.types().isEmpty()) {
            writer.sync(req.types(), req.items() == null ? List.of() : req.items());
        }
    }

    @PostMapping("/internal/notifications/resolve")
    @PreAuthorize("hasAuthority('internal')")
    public void resolve(@RequestBody List<String> dedupeKeys) {
        if (!dedupeKeys.isEmpty()) {
            writer.resolve(dedupeKeys);
        }
    }
}
