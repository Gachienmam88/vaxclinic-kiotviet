package com.vaxclinic.identity.role;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Tài khoản gắn với vai trò (bảng users, cột role_id). Chỉ truy cập DB. */
@Repository
public class RoleUserRepository {

    private final JdbcTemplate jdbc;

    public RoleUserRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** roleId → tên đăng nhập các tài khoản đang hoạt động (theo ABC). */
    public Map<UUID, List<String>> activeUsernamesByRole() {
        return jdbc.query("select role_id, username from users where active order by username",
                rs -> {
                    var m = new HashMap<UUID, List<String>>();
                    while (rs.next()) {
                        m.computeIfAbsent(rs.getObject(1, UUID.class), k -> new ArrayList<>()).add(rs.getString(2));
                    }
                    return m;
                });
    }

    /** Số tài khoản (kể cả đã khóa) đang gán vai trò. */
    public int countByRole(UUID roleId) {
        Integer users = jdbc.queryForObject("select count(*) from users where role_id = ?", Integer.class, roleId);
        return users == null ? 0 : users;
    }
}
