package com.vaxclinic.identity.branch.repository;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.Map;
import java.util.UUID;

/** Số tài khoản đang hoạt động theo điểm tiêm (bảng user_branches + users). Chỉ truy cập DB. */
@Repository
public class BranchUserCountRepository {

    private final JdbcTemplate jdbc;

    public BranchUserCountRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Map<UUID, Integer> activeUserCounts() {
        var counts = new java.util.HashMap<UUID, Integer>();
        jdbc.query("select ub.branch_id, count(*) from user_branches ub join users u on u.id = ub.user_id where u.active group by ub.branch_id",
                rs -> { counts.put(rs.getObject(1, UUID.class), rs.getInt(2)); });
        return counts;
    }
}
