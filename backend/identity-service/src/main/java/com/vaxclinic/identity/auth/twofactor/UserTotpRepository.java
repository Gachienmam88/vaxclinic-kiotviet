package com.vaxclinic.identity.auth.twofactor;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Bảng user_totp: khóa TOTP (đã mã hóa) + trạng thái bật + bộ đếm nhập sai của từng user. Chỉ truy cập DB, không nghiệp vụ. */
@Repository
public class UserTotpRepository {

    /** Một dòng user_totp. lastStep null = chưa dùng mã nào; lockedUntil null = không bị khóa. */
    public record TotpRow(String secretEnc, boolean enabled, Long lastStep, int failedAttempts, Instant lockedUntil) {
    }

    private final JdbcTemplate jdbc;

    public UserTotpRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Id các user đã bật 2FA (bảng nhỏ — 1 truy vấn cho danh sách người dùng). */
    public java.util.Set<UUID> findEnabledUserIds() {
        return new java.util.HashSet<>(jdbc.queryForList("select user_id from user_totp where enabled", UUID.class));
    }

    public Optional<TotpRow> find(UUID userId) {
        return query("select secret_enc, enabled, last_step, failed_attempts, locked_until from user_totp where user_id = ?", userId);
    }

    /** Đọc và khóa dòng tới hết giao dịch (2 lần nhập mã đồng thời không vượt giới hạn số lần thử). */
    public Optional<TotpRow> findForUpdate(UUID userId) {
        return query("select secret_enc, enabled, last_step, failed_attempts, locked_until from user_totp where user_id = ? for update", userId);
    }

    /** Tạo / thay khóa đang chờ xác nhận (chưa bật). */
    public void savePending(UUID userId, String secretEnc) {
        jdbc.update("""
                insert into user_totp(user_id, secret_enc, enabled) values (?, ?, false)
                on conflict (user_id) do update set secret_enc = excluded.secret_enc, enabled = false, last_step = null,
                  failed_attempts = 0, locked_until = null, created_at = now(), enabled_at = null""", userId, secretEnc);
    }

    public void markEnabled(UUID userId) {
        jdbc.update("update user_totp set enabled = true, enabled_at = now() where user_id = ?", userId);
    }

    /** Mã đúng: ghi bước thời gian đã dùng (lastStep null = mã khôi phục, giữ nguyên) và xóa bộ đếm sai. */
    public void recordSuccess(UUID userId, Long step) {
        jdbc.update("update user_totp set last_step = coalesce(?, last_step), failed_attempts = 0, locked_until = null where user_id = ?",
                step, userId);
    }

    public void recordFailure(UUID userId, int failedAttempts, Instant lockedUntil) {
        jdbc.update("update user_totp set failed_attempts = ?, locked_until = ? where user_id = ?",
                failedAttempts, lockedUntil == null ? null : Timestamp.from(lockedUntil), userId);
    }

    public void delete(UUID userId) {
        jdbc.update("delete from user_totp where user_id = ?", userId);
    }

    private Optional<TotpRow> query(String sql, UUID userId) {
        List<TotpRow> rows = jdbc.query(sql, (rs, n) -> {
            Timestamp locked = rs.getTimestamp("locked_until");
            long last = rs.getLong("last_step");
            return new TotpRow(rs.getString("secret_enc"), rs.getBoolean("enabled"), rs.wasNull() ? null : last,
                    rs.getInt("failed_attempts"), locked == null ? null : locked.toInstant());
        }, userId);
        return rows.stream().findFirst();
    }
}
