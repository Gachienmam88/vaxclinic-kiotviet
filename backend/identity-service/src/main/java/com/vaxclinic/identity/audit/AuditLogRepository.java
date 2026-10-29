package com.vaxclinic.identity.audit;

import com.vaxclinic.common.audit.AuditLogger.AuditEvent;
import com.vaxclinic.common.settings.ShopSettings;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/** Bảng audit_logs: ghi lô sự kiện, tra cứu có lọc, đọc tuần tự để xuất file. Chỉ truy cập DB. */
@Repository
public class AuditLogRepository {

    public record AuditLogItem(long id, Instant occurredAt, UUID userId, String userName, UUID branchId, String feature,
                               String action, String docCode, String detail) {
    }

    /** Bộ lọc tra cứu (userId / feature / from / to có thể null; q không null). */
    public record Filter(UUID userId, String feature, LocalDate from, LocalDate to, String q) {
    }

    private final JdbcTemplate jdbc;

    public AuditLogRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public void insert(List<AuditEvent> events) {
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

    public long count(Filter f) {
        var where = where(f);
        Long total = jdbc.queryForObject("select count(*) from audit_logs" + where.sql, Long.class, where.args.toArray());
        return total == null ? 0 : total;
    }

    /** Mới nhất trước. */
    public List<AuditLogItem> find(Filter f, int limit, long offset) {
        var where = where(f);
        var args = new ArrayList<>(where.args);
        args.add(limit);
        args.add(offset);
        return jdbc.query("select * from audit_logs" + where.sql + " order by occurred_at desc, id desc limit ? offset ?",
                (rs, i) -> new AuditLogItem(rs.getLong("id"), rs.getTimestamp("occurred_at").toInstant(),
                        rs.getObject("user_id", UUID.class), rs.getString("user_name"), rs.getObject("branch_id", UUID.class),
                        rs.getString("feature"), rs.getString("action"), rs.getString("doc_code"), rs.getString("detail")),
                args.toArray());
    }

    /** Duyệt tối đa {@code limit} dòng mới nhất (để xuất file), từng dòng qua {@code handler}. */
    public void forEach(Filter f, int limit, RowCallbackHandler handler) {
        var where = where(f);
        jdbc.query("select * from audit_logs" + where.sql + " order by occurred_at desc limit " + limit, handler, where.args.toArray());
    }

    public List<String> features() {
        return jdbc.queryForList("select distinct feature from audit_logs order by feature", String.class);
    }

    private record Where(String sql, List<Object> args) {
    }

    private static Where where(Filter f) {
        var sql = new StringBuilder(" where 1=1");
        var args = new ArrayList<Object>();
        if (f.userId() != null) {
            sql.append(" and user_id = ?");
            args.add(f.userId());
        }
        if (f.feature() != null && !f.feature().isBlank()) {
            sql.append(" and feature = ?");
            args.add(f.feature());
        }
        if (f.from() != null) {
            sql.append(" and occurred_at >= ?");
            args.add(Timestamp.from(f.from().atStartOfDay(ShopSettings.ZONE).toInstant()));
        }
        if (f.to() != null) {
            sql.append(" and occurred_at < ?");
            args.add(Timestamp.from(f.to().plusDays(1).atStartOfDay(ShopSettings.ZONE).toInstant()));
        }
        if (!f.q().isBlank()) {
            sql.append(" and (doc_code ilike ? or detail ilike ?)");
            String like = "%" + f.q().trim().replace("%", "\\%").replace("_", "\\_") + "%";
            args.add(like);
            args.add(like);
        }
        return new Where(sql.toString(), args);
    }

    private static String cut(String s, int max) {
        return s == null || s.length() <= max ? s : s.substring(0, max);
    }
}
