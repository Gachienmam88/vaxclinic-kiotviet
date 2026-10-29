package com.vaxclinic.identity.notification;

import com.vaxclinic.common.notification.NotificationClient.Item;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Ghi bảng notifications (cảnh báo tự sinh, cảnh báo gửi riêng 1 user). Quy tắc gộp / mở lại nằm ở {@link NotificationWriter}. Chỉ truy cập DB. */
@Repository
public class NotificationWriteRepository {

    private final JdbcTemplate jdbc;

    public NotificationWriteRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Cảnh báo mới nhất cùng khóa (id, resolved_at, created_at); rỗng = chưa có. */
    public List<Map<String, Object>> findLatestByDedupeKey(String dedupeKey) {
        return jdbc.queryForList("""
                select id, resolved_at, created_at from notifications where dedupe_key = ?
                order by created_at desc, id desc limit 1""", dedupeKey);
    }

    /** Cập nhật nội dung + mở lại; không đụng dòng nếu đang mở và nội dung không đổi. */
    public void refresh(Object id, Item it) {
        jdbc.update("""
                update notifications set title = ?, body = ?, doc_code = ?, link = ?, branch_id = ?, permission = ?,
                  resolved_at = null, updated_at = now()
                where id = ? and (resolved_at is not null
                  or (title, body, doc_code, link, branch_id, permission) is distinct from (?, ?, ?, ?, ?, ?))""",
                cut(it.title(), 300), it.body(), cut(it.docCode(), 50), cut(it.link(), 500), it.branchId(), it.permission(),
                id,
                cut(it.title(), 300), it.body(), cut(it.docCode(), 50), cut(it.link(), 500), it.branchId(), it.permission());
    }

    public void insert(Item it) {
        jdbc.update("""
                insert into notifications(category, type, dedupe_key, title, body, doc_code, link, branch_id, permission)
                values ('ALERT', ?, ?, ?, ?, ?, ?, ?, ?)""",
                cut(it.type(), 30), cut(it.dedupeKey(), 200), cut(it.title(), 300), it.body(), cut(it.docCode(), 50),
                cut(it.link(), 500), it.branchId(), cut(it.permission(), 50));
    }

    /** Đóng cảnh báo đang mở thuộc `types` có khóa không nằm trong `keys`. */
    public void resolveTypesExcept(String[] types, String[] keys) {
        jdbc.update("""
                update notifications set resolved_at = now() where resolved_at is null and category = 'ALERT'
                  and type = any(?) and not (dedupe_key = any(?))""", types, keys);
    }

    public void resolveKeys(String[] keys) {
        jdbc.update("update notifications set resolved_at = now() where resolved_at is null and dedupe_key = any(?)",
                (Object) keys);
    }

    /** Xóa cảnh báo đã đóng quá 30 ngày và cảnh báo quá 90 ngày. */
    public void deleteOldAlerts() {
        jdbc.update("""
                delete from notifications where category = 'ALERT'
                  and (resolved_at < now() - interval '30 days' or created_at < now() - interval '90 days')""");
    }

    public void insertForUser(UUID targetUserId, String type, String title, String body, String link) {
        jdbc.update("""
                insert into notifications(category, type, title, body, link, target_user_id)
                values ('ALERT', ?, ?, ?, ?, ?)""", cut(type, 30), cut(title, 300), body, cut(link, 500), targetUserId);
    }

    static String cut(String s, int max) {
        return s == null || s.length() <= max ? s : s.substring(0, max);
    }
}
