package com.vaxclinic.product.purchase;

import com.vaxclinic.product.purchase.SupplierGroupService.GroupResponse;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

/** Bảng supplier_groups: danh sách kèm số NCC, thêm / sửa / xóa, tìm theo tên. Chỉ truy cập DB. */
@Repository
public class SupplierGroupRepository {

    private final JdbcTemplate jdbc;

    public SupplierGroupRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Mọi nhóm theo tên (không phân biệt hoa thường) kèm số NCC trong nhóm. */
    public List<GroupResponse> list() {
        return jdbc.query("""
                select g.id, g.name, g.note, (select count(*) from suppliers s where s.group_id = g.id) n
                from supplier_groups g order by lower(g.name)""",
                (rs, i) -> new GroupResponse(rs.getObject(1, UUID.class), rs.getString(2), rs.getString(3), rs.getLong(4)));
    }

    public void insert(UUID id, String name, String note) {
        jdbc.update("insert into supplier_groups(id, name, note) values (?, ?, ?)", id, name, note);
    }

    /** Thêm nhóm chỉ có tên (tạo nhanh khi lưu NCC / import). */
    public void insert(UUID id, String name) {
        jdbc.update("insert into supplier_groups(id, name) values (?, ?)", id, name);
    }

    /** Số dòng đã sửa (0 = không có nhóm). */
    public int update(UUID id, String name, String note) {
        return jdbc.update("update supplier_groups set name = ?, note = ? where id = ?", name, note, id);
    }

    /** Xóa và trả tên nhóm đã xóa (rỗng = không có nhóm). */
    public List<String> deleteReturningName(UUID id) {
        return jdbc.queryForList("delete from supplier_groups where id = ? returning name", String.class, id);
    }

    public List<UUID> findIdsByName(String name) {
        return jdbc.queryForList("select id from supplier_groups where lower(name) = lower(?)", UUID.class, name);
    }

    public Long countById(UUID id) {
        return jdbc.queryForObject("select count(*) from supplier_groups where id = ?", Long.class, id);
    }

    /** Số nhóm trùng tên (không phân biệt hoa thường), trừ nhóm exceptId. */
    public Long countByNameExcept(String name, UUID exceptId) {
        return jdbc.queryForObject("select count(*) from supplier_groups where lower(name) = lower(?) and id is distinct from ?",
                Long.class, name, exceptId);
    }
}
