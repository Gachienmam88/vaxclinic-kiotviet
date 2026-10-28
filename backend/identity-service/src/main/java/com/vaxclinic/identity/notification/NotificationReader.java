package com.vaxclinic.identity.notification;

import com.vaxclinic.common.web.PageResponse;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/** Đọc hộp thư theo người xem (chi nhánh + quyền) và trạng thái đã đọc của từng người. */
@Component
public class NotificationReader {

    /** read: người xem đã đọc; branchName null = mọi chi nhánh. */
    public record NotificationItem(long id, String category, String type, String title, String body, String docCode,
                                   String link, UUID branchId, String branchName, String createdByName,
                                   Instant createdAt, boolean read) {
    }

    /** count: tổng chưa đọc; alert / update: theo tab Cảnh báo / Cập nhật. */
    public record UnreadCount(long count, long alert, long update) {
    }

    /** Bộ lọc hiển thị: chưa đóng, đúng chi nhánh người xem làm việc (hoặc mọi chi nhánh), đúng quyền. */
    private static final String VISIBLE = " n.resolved_at is null and (n.branch_id is null or n.branch_id::text = any(?))"
            + " and (n.permission is null or n.permission = any(?))";

    private final JdbcTemplate jdbc;

    public NotificationReader(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public PageResponse<NotificationItem> list(NotificationViewer v, String tab, int page, int size) {
        int limit = Math.min(Math.max(size, 1), 100);
        String category = category(tab);
        String where = " where" + VISIBLE + (category == null ? "" : " and n.category = ?");
        List<Object> args = new ArrayList<>(List.of(v.branchIds(), v.permissions()));
        if (category != null) {
            args.add(category);
        }
        Long total = jdbc.queryForObject("select count(*) from notifications n" + where, Long.class, args.toArray());
        List<Object> pageArgs = new ArrayList<>();
        pageArgs.add(v.userId());
        pageArgs.addAll(args);
        pageArgs.add(limit);
        pageArgs.add((long) Math.max(page, 0) * limit);
        var items = jdbc.query("select n.*, b.name as branch_name, r.user_id is not null as is_read from notifications n"
                        + " left join branches b on b.id = n.branch_id"
                        + " left join notification_reads r on r.notification_id = n.id and r.user_id = ?" + where
                        + " order by n.created_at desc, n.id desc limit ? offset ?",
                (rs, i) -> new NotificationItem(rs.getLong("id"), rs.getString("category"), rs.getString("type"),
                        rs.getString("title"), rs.getString("body"), rs.getString("doc_code"), rs.getString("link"),
                        rs.getObject("branch_id", UUID.class), rs.getString("branch_name"), rs.getString("created_by_name"),
                        rs.getTimestamp("created_at").toInstant(), rs.getBoolean("is_read")),
                pageArgs.toArray());
        return new PageResponse<>(items, total == null ? 0 : total, page, limit);
    }

    public UnreadCount unread(NotificationViewer v) {
        return jdbc.queryForObject("select count(*) as total, count(*) filter (where n.category = 'ALERT') as alert,"
                        + " count(*) filter (where n.category = 'UPDATE') as upd from notifications n where" + VISIBLE
                        + " and not exists (select 1 from notification_reads r where r.notification_id = n.id and r.user_id = ?)",
                (rs, i) -> new UnreadCount(rs.getLong("total"), rs.getLong("alert"), rs.getLong("upd")),
                v.branchIds(), v.permissions(), v.userId());
    }

    public void markRead(NotificationViewer v, long id) {
        jdbc.update("insert into notification_reads(notification_id, user_id) select id, ? from notifications where id = ?"
                + " on conflict do nothing", v.userId(), id);
    }

    /** Đánh dấu đã đọc tất cả thông báo người xem đang thấy (theo tab nếu có). */
    public int markAllRead(NotificationViewer v, String tab) {
        String category = category(tab);
        List<Object> args = new ArrayList<>(List.of(v.userId(), v.branchIds(), v.permissions()));
        if (category != null) {
            args.add(category);
        }
        return jdbc.update("insert into notification_reads(notification_id, user_id) select n.id, ? from notifications n where"
                + VISIBLE + (category == null ? "" : " and n.category = ?") + " on conflict do nothing", args.toArray());
    }

    private static String category(String tab) {
        return switch (tab == null ? "" : tab.toLowerCase()) {
            case "alert" -> "ALERT";
            case "update" -> "UPDATE";
            default -> null;
        };
    }
}
