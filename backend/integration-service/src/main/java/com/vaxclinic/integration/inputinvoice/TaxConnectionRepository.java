package com.vaxclinic.integration.inputinvoice;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Tài khoản cổng thuế theo MST (tax_connections). Chỉ truy cập DB; mật khẩu nhận / lưu dạng đã mã hóa. */
@Repository
public class TaxConnectionRepository {

    /** Không có mật khẩu: không bao giờ trả ra API. */
    public record ConnectionResponse(UUID id, String taxCode, String username, boolean active, Instant lastSyncedAt,
                                     String lastError) {
    }

    private final JdbcTemplate jdbc;

    public TaxConnectionRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<ConnectionResponse> findAll() {
        return jdbc.query("select * from tax_connections order by created_at", (rs, n) -> new ConnectionResponse(
                rs.getObject("id", UUID.class), rs.getString("tax_code"), rs.getString("username"), rs.getBoolean("active"),
                rs.getTimestamp("last_synced_at") == null ? null : rs.getTimestamp("last_synced_at").toInstant(),
                rs.getString("last_error")));
    }

    /** Dòng đầy đủ (gồm password_enc) để đăng nhập cổng thuế; null khi không có. */
    public Map<String, Object> findById(UUID id) {
        var rows = jdbc.queryForList("select * from tax_connections where id = ?", id);
        return rows.isEmpty() ? null : rows.get(0);
    }

    /** Ném DuplicateKeyException khi MST đã kết nối. */
    public void insert(UUID id, String taxCode, String username, String passwordEnc) {
        jdbc.update("insert into tax_connections(id, tax_code, username, password_enc) values (?,?,?,?)",
                id, taxCode, username, passwordEnc);
    }

    /** passwordEnc null = giữ mật khẩu cũ. Trả số dòng đã sửa (0 = không có kết nối). */
    public int update(UUID id, String taxCode, String username, String passwordEnc) {
        return passwordEnc == null
                ? jdbc.update("update tax_connections set tax_code = ?, username = ? where id = ?", taxCode, username, id)
                : jdbc.update("update tax_connections set tax_code = ?, username = ?, password_enc = ? where id = ?",
                taxCode, username, passwordEnc, id);
    }

    public void delete(UUID id) {
        jdbc.update("delete from tax_connections where id = ?", id);
    }

    public void markSynced(UUID id, Instant at) {
        jdbc.update("update tax_connections set last_synced_at = ?, last_error = null where id = ?", Timestamp.from(at), id);
    }

    public void markError(UUID id, String error) {
        jdbc.update("update tax_connections set last_error = ? where id = ?", error, id);
    }
}
