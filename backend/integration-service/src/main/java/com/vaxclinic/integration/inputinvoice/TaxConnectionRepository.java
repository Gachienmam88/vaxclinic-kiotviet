package com.vaxclinic.integration.inputinvoice;

import com.vaxclinic.integration.inputinvoice.TaxConnectionDtos.ConnectionResponse;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** tax_connections: tài khoản cổng thuế theo MST (mật khẩu mã hóa AES-GCM). */
@Repository
public class TaxConnectionRepository {

    private final JdbcTemplate jdbc;

    public TaxConnectionRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<ConnectionResponse> list() {
        return jdbc.query("select * from tax_connections order by created_at", (rs, n) -> new ConnectionResponse(
                rs.getObject("id", UUID.class), rs.getString("tax_code"), rs.getString("username"), rs.getBoolean("active"),
                rs.getTimestamp("last_synced_at") == null ? null : rs.getTimestamp("last_synced_at").toInstant(),
                rs.getString("last_error")));
    }

    /** @throws org.springframework.dao.DuplicateKeyException MST đã được kết nối */
    public void insert(UUID id, String taxCode, String username, String passwordEnc) {
        jdbc.update("insert into tax_connections(id, tax_code, username, password_enc) values (?,?,?,?)",
                id, taxCode, username, passwordEnc);
    }

    /** Giữ mật khẩu cũ. @return số dòng cập nhật */
    public int update(UUID id, String taxCode, String username) {
        return jdbc.update("update tax_connections set tax_code = ?, username = ? where id = ?", taxCode, username, id);
    }

    /** @return số dòng cập nhật */
    public int update(UUID id, String taxCode, String username, String passwordEnc) {
        return jdbc.update("update tax_connections set tax_code = ?, username = ?, password_enc = ? where id = ?",
                taxCode, username, passwordEnc, id);
    }

    public void delete(UUID id) {
        jdbc.update("delete from tax_connections where id = ?", id);
    }

    public List<Map<String, Object>> findRows(UUID id) {
        return jdbc.queryForList("select * from tax_connections where id = ?", id);
    }

    public void markSynced(UUID id, Timestamp at) {
        jdbc.update("update tax_connections set last_synced_at = ?, last_error = null where id = ?", at, id);
    }

    public void markError(UUID id, String error) {
        jdbc.update("update tax_connections set last_error = ? where id = ?", error, id);
    }
}
