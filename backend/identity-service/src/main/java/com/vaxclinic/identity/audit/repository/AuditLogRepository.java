package com.vaxclinic.identity.audit.repository;

import com.vaxclinic.identity.audit.dto.AuditLogItem;
import com.vaxclinic.common.audit.AuditLogger.AuditEvent;
import com.vaxclinic.common.settings.ShopSettings;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.function.Consumer;

/** Bảng audit_logs: ghi lô sự kiện, tra cứu có lọc, đọc để xuất CSV. Chỉ truy cập DB. */
@Repository
public class AuditLogRepository {

    /** Dòng đọc ra để xuất CSV. */
    public record ExportRow(String userName, String feature, String action, String docCode, Instant occurredAt, String detail) {
    }

    public record Where(String sql, List<Object> args) {
    }

    private final JdbcTemplate jdbc;

    public AuditLogRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public static void insert(JdbcTemplate jdbc, List<AuditEvent> events) {
        jdbc.batchUpdate("insert into audit_logs(occurred_at, user_id, user_name, branch_id, feature, action, doc_code, detail)"
                + " values (?,?,?,?,?,?,?,?)", events, events.size(), (ps, e) -> {
            ps.setTimestamp(1, Timestamp.from(e.occurredAt() == null ? Instant.now() : e.occurredAt()));
            ps.setObject(2, e.userId());
            ps.setString(3, cut(e.userName(), 150));
            ps.setObject(4, e.branchId());
            ps.setString(5, cut(e.feature(), 50));
            ps.setString(6, cut(e.action(), 30));
            ps.setString(7, cut(e.docCode(), 50));
            ps.setString(8, cut(e.detail(), 1000));
        });
    }

    private static String cut(String s, int max) {
        return s == null || s.length() <= max ? s : s.substring(0, max);
    }

    public void insert(List<AuditEvent> events) {
        insert(jdbc, events);
    }

    public Long count(Where where) {
        return jdbc.queryForObject("select count(*) from audit_logs" + where.sql, Long.class, where.args.toArray());
    }

    public List<AuditLogItem> search(Where where, int limit, long offset) {
        var args = new ArrayList<>(where.args);
        args.add(limit);
        args.add(offset);
        return jdbc.query("select * from audit_logs" + where.sql + " order by occurred_at desc, id desc limit ? offset ?",
                (rs, i) -> new AuditLogItem(rs.getLong("id"), rs.getTimestamp("occurred_at").toInstant(),
                        rs.getObject("user_id", UUID.class), rs.getString("user_name"), rs.getObject("branch_id", UUID.class),
                        rs.getString("feature"), rs.getString("action"), rs.getString("doc_code"), rs.getString("detail")),
                args.toArray());
    }

    /** Tối đa 50.000 dòng mới nhất theo bộ lọc, gọi row cho từng dòng theo thứ tự. */
    public void export(Where where, Consumer<ExportRow> row) {
        jdbc.query("select * from audit_logs" + where.sql + " order by occurred_at desc limit 50000", rs -> {
            row.accept(new ExportRow(rs.getString("user_name"), rs.getString("feature"), rs.getString("action"),
                    rs.getString("doc_code"), rs.getTimestamp("occurred_at").toInstant(), rs.getString("detail")));
        }, where.args.toArray());
    }

    public List<String> features() {
        return jdbc.queryForList("select distinct feature from audit_logs order by feature", String.class);
    }

    public static Where where(UUID userId, String feature, LocalDate from, LocalDate to, String q) {
        var sql = new StringBuilder(" where 1=1");
        var args = new ArrayList<Object>();
        if (userId != null) {
            sql.append(" and user_id = ?");
            args.add(userId);
        }
        if (feature != null && !feature.isBlank()) {
            sql.append(" and feature = ?");
            args.add(feature);
        }
        if (from != null) {
            sql.append(" and occurred_at >= ?");
            args.add(Timestamp.from(from.atStartOfDay(ShopSettings.ZONE).toInstant()));
        }
        if (to != null) {
            sql.append(" and occurred_at < ?");
            args.add(Timestamp.from(to.plusDays(1).atStartOfDay(ShopSettings.ZONE).toInstant()));
        }
        if (!q.isBlank()) {
            sql.append(" and (doc_code ilike ? or detail ilike ?)");
            String like = "%" + q.trim().replace("%", "\\%").replace("_", "\\_") + "%";
            args.add(like);
            args.add(like);
        }
        return new Where(sql.toString(), args);
    }
}
