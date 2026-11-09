package com.vaxclinic.identity.role;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Tài khoản theo vai trò (bảng users) cho màn Quản lý vai trò. Chỉ truy cập DB. */
@Repository
public class RoleUserRepository {

    private final JdbcTemplate jdbc;

    public RoleUserRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** role_id → username của các tài khoản đang hoạt động (sắp theo username). */
    public Map<UUID, List<String>> activeUsernamesByRole() {
        return jdbc.query("select role_id, username from users where active order by username",
                rs -> {
                    var m = new java.util.HashMap<UUID, List<String>>();
                    while (rs.next()) {
                        m.computeIfAbsent(rs.getObject(1, UUID.class), k -> new java.util.ArrayList<>()).add(rs.getString(2));
                    }
                    return m;
                });
    }

    public Integer countByRole(UUID roleId) {
        return jdbc.queryForObject("select count(*) from users where role_id = ?", Integer.class, roleId);
    }
}
