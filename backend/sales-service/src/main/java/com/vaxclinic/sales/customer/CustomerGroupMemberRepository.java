package com.vaxclinic.sales.customer;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/** Khách thuộc nhóm (customers.group_id / group_name): đếm theo nhóm, đổi tên nhóm, bỏ nhóm khi xóa nhóm. */
@Repository
public class CustomerGroupMemberRepository {

    private final JdbcTemplate jdbc;

    public CustomerGroupMemberRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Số khách đang hoạt động của từng nhóm (nhóm không có khách thì không có trong map). */
    public Map<UUID, Long> activeCounts() {
        Map<UUID, Long> counts = new HashMap<>();
        jdbc.query("select group_id, count(*) from customers where group_id is not null and active group by group_id",
                rs -> {
                    counts.put(rs.getObject(1, UUID.class), rs.getLong(2));
                });
        return counts;
    }

    public Long activeCount(UUID groupId) {
        return jdbc.queryForObject("select count(*) from customers where group_id = ? and active", Long.class, groupId);
    }

    /** Cập nhật bản sao tên nhóm ở khách thuộc nhóm. */
    public void renameGroup(UUID groupId, String name) {
        jdbc.update("update customers set group_name = ? where group_id = ?", name, groupId);
    }

    /** Bỏ nhóm của mọi khách trong nhóm; trả về số khách bị bỏ nhóm. */
    public int unlinkGroup(UUID groupId) {
        return jdbc.update("update customers set group_id = null, group_name = null where group_id = ?", groupId);
    }
}
