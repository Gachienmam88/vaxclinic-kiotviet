package com.vaxclinic.product.purchase.repository;

import com.vaxclinic.product.purchase.dto.SupplierGroupDtos;
import com.vaxclinic.product.purchase.dto.SupplierGroupDtos.GroupResponse;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

/** SQL bảng supplier_groups (JDBC). */
@Repository
public class SupplierGroupRepository {

    private final JdbcTemplate jdbc;

    public SupplierGroupRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<GroupResponse> list() {
        return jdbc.query("""
                select g.id, g.name, g.note, (select count(*) from suppliers s where s.group_id = g.id) n
                from supplier_groups g order by lower(g.name)""",
                (rs, i) -> new GroupResponse(rs.getObject(1, UUID.class), rs.getString(2), rs.getString(3), rs.getLong(4)));
    }

    public void insert(UUID id, String name, String note) {
        jdbc.update("insert into supplier_groups(id, name, note) values (?, ?, ?)", id, name, note);
    }

    public int update(UUID id, String name, String note) {
        return jdbc.update("update supplier_groups set name = ?, note = ? where id = ?", name, note, id);
    }

    /** Xóa và trả tên nhóm đã xóa (rỗng nếu không có). */
    public List<String> deleteReturningName(UUID id) {
        return jdbc.queryForList("delete from supplier_groups where id = ? returning name", String.class, id);
    }

    public List<UUID> findIdsByName(String name) {
        return jdbc.queryForList("select id from supplier_groups where lower(name) = lower(?)", UUID.class, name);
    }

    public void insertName(UUID id, String name) {
        jdbc.update("insert into supplier_groups(id, name) values (?, ?)", id, name);
    }

    public Long countById(UUID id) {
        return jdbc.queryForObject("select count(*) from supplier_groups where id = ?", Long.class, id);
    }

    public Long countByNameExcept(String name, UUID exceptId) {
        return jdbc.queryForObject("select count(*) from supplier_groups where lower(name) = lower(?) and id is distinct from ?",
                Long.class, name, exceptId);
    }
}
