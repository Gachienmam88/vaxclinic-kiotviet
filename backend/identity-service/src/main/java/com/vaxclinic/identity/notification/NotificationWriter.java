package com.vaxclinic.identity.notification;

import com.vaxclinic.common.notification.NotificationClient.Item;
import com.vaxclinic.common.settings.ShopSettings;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Ghi cảnh báo tự sinh (category ALERT) theo dedupeKey:
 * - đang mở cùng khóa → chỉ cập nhật nội dung (giữ trạng thái đã đọc);
 * - đã đóng nhưng tạo trong hôm nay → mở lại (mỗi đối tượng tối đa 1 cảnh báo / ngày, không nhấp nháy);
 * - còn lại → tạo mới (chưa đọc với mọi người).
 */
@Component
public class NotificationWriter {

    private final NotificationWriteRepository repo;

    public NotificationWriter(NotificationWriteRepository repo) {
        this.repo = repo;
    }

    @Transactional
    public void upsert(List<Item> items) {
        Timestamp startOfToday = Timestamp.from(LocalDate.now(ShopSettings.ZONE).atStartOfDay(ShopSettings.ZONE).toInstant());
        for (Item it : items) {
            if (it.dedupeKey() == null || it.dedupeKey().isBlank() || it.title() == null || it.title().isBlank()) {
                continue;
            }
            List<Map<String, Object>> last = repo.findLatestByDedupeKey(it.dedupeKey());
            if (last.isEmpty()) {
                repo.insert(it);
                continue;
            }
            Map<String, Object> row = last.get(0);
            boolean open = row.get("resolved_at") == null;
            boolean today = !((Timestamp) row.get("created_at")).before(startOfToday);
            if (open || today) {
                repo.refresh(row.get("id"), it);
            } else {
                repo.insert(it);
            }
        }
    }

    /** Ghi các cảnh báo đang đúng của `types` rồi đóng các cảnh báo cùng loại không còn trong danh sách. */
    @Transactional
    public void sync(List<String> types, List<Item> items) {
        List<Item> own = items.stream().filter(i -> types.contains(i.type())).toList();
        upsert(own);
        String[] keys = own.stream().map(Item::dedupeKey).toArray(String[]::new);
        repo.resolveTypesExcept(types.toArray(String[]::new), keys);
    }

    @Transactional
    public void resolve(List<String> keys) {
        repo.resolveKeys(keys.toArray(String[]::new));
    }

    /** Mỗi ngày dọn cảnh báo đã đóng quá 30 ngày và cảnh báo sự kiện quá 90 ngày (thông báo nội bộ giữ lại). */
    @Scheduled(initialDelay = 120_000, fixedDelay = 24 * 3600_000)
    public void cleanup() {
        repo.deleteOldAlerts();
    }

    /** Cảnh báo gửi riêng 1 user (tab "Cảnh báo"); không gộp theo dedupeKey — mỗi sự kiện 1 dòng. */
    public void insertForUser(UUID targetUserId, String type, String title, String body, String link) {
        repo.insertForUser(targetUserId, type, title, body, link);
    }
}
