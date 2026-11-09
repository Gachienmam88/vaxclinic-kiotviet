package com.vaxclinic.identity.notification.service;

import com.vaxclinic.common.notification.NotificationClient.Item;
import com.vaxclinic.common.settings.ShopSettings;
import org.springframework.jdbc.core.JdbcTemplate;
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

    private final JdbcTemplate jdbc;

    public NotificationWriter(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional
    public void upsert(List<Item> items) {
        Timestamp startOfToday = Timestamp.from(LocalDate.now(ShopSettings.ZONE).atStartOfDay(ShopSettings.ZONE).toInstant());
        for (Item it : items) {
            if (it.dedupeKey() == null || it.dedupeKey().isBlank() || it.title() == null || it.title().isBlank()) {
                continue;
            }
            List<Map<String, Object>> last = jdbc.queryForList("""
                    select id, resolved_at, created_at from notifications where dedupe_key = ?
                    order by created_at desc, id desc limit 1""", it.dedupeKey());
            if (last.isEmpty()) {
                insert(it);
                continue;
            }
            Map<String, Object> row = last.get(0);
            boolean open = row.get("resolved_at") == null;
            boolean today = !((Timestamp) row.get("created_at")).before(startOfToday);
            if (open || today) {
                jdbc.update("""
                        update notifications set title = ?, body = ?, doc_code = ?, link = ?, branch_id = ?, permission = ?,
                          resolved_at = null, updated_at = now()
                        where id = ? and (resolved_at is not null
                          or (title, body, doc_code, link, branch_id, permission) is distinct from (?, ?, ?, ?, ?, ?))""",
                        cut(it.title(), 300), it.body(), cut(it.docCode(), 50), cut(it.link(), 500), it.branchId(), it.permission(),
                        row.get("id"),
                        cut(it.title(), 300), it.body(), cut(it.docCode(), 50), cut(it.link(), 500), it.branchId(), it.permission());
            } else {
                insert(it);
            }
        }
    }

    /** Ghi các cảnh báo đang đúng của `types` rồi đóng các cảnh báo cùng loại không còn trong danh sách. */
    @Transactional
    public void sync(List<String> types, List<Item> items) {
        List<Item> own = items.stream().filter(i -> types.contains(i.type())).toList();
        upsert(own);
        String[] keys = own.stream().map(Item::dedupeKey).toArray(String[]::new);
        jdbc.update("""
                update notifications set resolved_at = now() where resolved_at is null and category = 'ALERT'
                  and type = any(?) and not (dedupe_key = any(?))""", types.toArray(String[]::new), keys);
    }

    @Transactional
    public void resolve(List<String> keys) {
        jdbc.update("update notifications set resolved_at = now() where resolved_at is null and dedupe_key = any(?)",
                (Object) keys.toArray(String[]::new));
    }

    /** Mỗi ngày dọn cảnh báo đã đóng quá 30 ngày và cảnh báo sự kiện quá 90 ngày (thông báo nội bộ giữ lại). */
    @Scheduled(initialDelay = 120_000, fixedDelay = 24 * 3600_000)
    public void cleanup() {
        jdbc.update("""
                delete from notifications where category = 'ALERT'
                  and (resolved_at < now() - interval '30 days' or created_at < now() - interval '90 days')""");
    }

    /** Cảnh báo gửi riêng 1 user (tab "Cảnh báo"); không gộp theo dedupeKey — mỗi sự kiện 1 dòng. */
    public void insertForUser(UUID targetUserId, String type, String title, String body, String link) {
        jdbc.update("""
                insert into notifications(category, type, title, body, link, target_user_id)
                values ('ALERT', ?, ?, ?, ?, ?)""", cut(type, 30), cut(title, 300), body, cut(link, 500), targetUserId);
    }

    private void insert(Item it) {
        jdbc.update("""
                insert into notifications(category, type, dedupe_key, title, body, doc_code, link, branch_id, permission)
                values ('ALERT', ?, ?, ?, ?, ?, ?, ?, ?)""",
                cut(it.type(), 30), cut(it.dedupeKey(), 200), cut(it.title(), 300), it.body(), cut(it.docCode(), 50),
                cut(it.link(), 500), it.branchId(), cut(it.permission(), 50));
    }

    static String cut(String s, int max) {
        return s == null || s.length() <= max ? s : s.substring(0, max);
    }
}
