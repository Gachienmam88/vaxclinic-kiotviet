package com.vaxclinic.identity.storeprofile.repository;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

/** Tab "Lịch sử cập nhật": đọc bảng audit_logs theo tính năng (ghi qua AuditLogger). Chỉ truy cập DB. */
@Repository
public class StoreProfileHistoryRepository {

    public record HistoryItem(long id, Instant occurredAt, String userName, String detail) {
    }

    private final JdbcTemplate jdbc;

    public StoreProfileHistoryRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public long countByFeature(String feature) {
        Long n = jdbc.queryForObject("select count(*) from audit_logs where feature = ?", Long.class, feature);
        return n == null ? 0 : n;
    }

    /** Mới nhất trước. */
    public List<HistoryItem> findByFeature(String feature, int limit, long offset) {
        return jdbc.query("select id, occurred_at, user_name, detail from audit_logs where feature = ?"
                        + " order by occurred_at desc, id desc limit ? offset ?",
                (rs, n) -> new HistoryItem(rs.getLong(1), rs.getTimestamp(2).toInstant(), rs.getString(3), rs.getString(4)),
                feature, limit, offset);
    }
}
