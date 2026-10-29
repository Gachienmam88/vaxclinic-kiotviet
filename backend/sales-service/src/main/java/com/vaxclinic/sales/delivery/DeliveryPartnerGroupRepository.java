package com.vaxclinic.sales.delivery;

import com.vaxclinic.sales.delivery.DeliveryPartnerDtos.GroupRow;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

/** Nhóm đối tác giao hàng (delivery_partner_groups): danh sách kèm số đối tác, thêm mới, kiểm tra tồn tại. */
@Repository
public class DeliveryPartnerGroupRepository {

    private final JdbcTemplate jdbc;

    public DeliveryPartnerGroupRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<GroupRow> list() {
        return jdbc.query("""
                select g.id, g.name, (select count(*) from delivery_partners p where p.group_id = g.id) cnt
                from delivery_partner_groups g order by lower(g.name)""",
                (rs, n) -> new GroupRow(rs.getObject("id", UUID.class), rs.getString("name"), rs.getLong("cnt")));
    }

    /** Ném DuplicateKeyException khi trùng tên (không phân biệt hoa thường). */
    public void insert(UUID id, String name, UUID createdBy) {
        jdbc.update("insert into delivery_partner_groups(id, name, created_by) values (?,?,?)", id, name, createdBy);
    }

    public boolean exists(UUID id) {
        return Boolean.TRUE.equals(jdbc.query("select 1 from delivery_partner_groups where id = ?", rs -> rs.next(), id));
    }
}
