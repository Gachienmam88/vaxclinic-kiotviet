package com.vaxclinic.identity.branch;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/** Đếm số tài khoản đang hoạt động theo điểm tiêm (bảng user_branches). Chỉ truy cập DB. */
@Repository
public class BranchUserCountRepository {

    private final JdbcTemplate jdbc;

    public BranchUserCountRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** branchId → số user active; chi nhánh không có user thì không có trong map. */
    public Map<UUID, Integer> activeUserCounts() {
        var counts = new HashMap<UUID, Integer>();
        jdbc.query("select ub.branch_id, count(*) from user_branches ub join users u on u.id = ub.user_id where u.active group by ub.branch_id",
                rs -> { counts.put(rs.getObject(1, UUID.class), rs.getInt(2)); });
        return counts;
    }
}
