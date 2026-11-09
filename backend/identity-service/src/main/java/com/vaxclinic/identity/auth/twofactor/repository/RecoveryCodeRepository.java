package com.vaxclinic.identity.auth.twofactor.repository;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

/** Bảng user_recovery_codes: mã khôi phục 2 lớp (chỉ lưu HMAC), dùng 1 lần. */
@Repository
public class RecoveryCodeRepository {

    private final JdbcTemplate jdbc;

    public RecoveryCodeRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public int countUnused(UUID userId) {
        Integer n = jdbc.queryForObject("select count(*) from user_recovery_codes where user_id = ? and used_at is null",
                Integer.class, userId);
        return n == null ? 0 : n;
    }

    /** Thay toàn bộ mã của user bằng bộ mã mới. */
    public void replaceAll(UUID userId, List<String> codeHashes) {
        deleteAll(userId);
        jdbc.batchUpdate("insert into user_recovery_codes(user_id, code_hash) values (?, ?)",
                codeHashes.stream().map(h -> new Object[]{userId, h}).toList());
    }

    /** Đánh dấu đã dùng 1 mã chưa dùng khớp hash; true nếu có mã như vậy. */
    public boolean consume(UUID userId, String codeHash) {
        return jdbc.update("update user_recovery_codes set used_at = now() where id = (select id from user_recovery_codes"
                + " where user_id = ? and code_hash = ? and used_at is null limit 1)", userId, codeHash) == 1;
    }

    public void deleteAll(UUID userId) {
        jdbc.update("delete from user_recovery_codes where user_id = ?", userId);
    }
}
