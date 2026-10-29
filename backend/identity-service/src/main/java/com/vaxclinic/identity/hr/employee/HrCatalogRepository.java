package com.vaxclinic.identity.hr.employee;

import com.vaxclinic.identity.hr.employee.HrCatalogController.CatalogItem;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

/**
 * Danh mục Phòng ban (hr_departments) / Chức danh (hr_job_titles). Tên bảng / cột lấy từ {@link Kind} cố định
 * (không từ người dùng). Chỉ truy cập DB; trùng tên → DuplicateKeyException.
 */
@Repository
public class HrCatalogRepository {

    /** table: bảng danh mục; column: cột tham chiếu trong hr_employees; label: tên hiển thị trong thông báo. */
    public record Kind(String table, String column, String label) {
    }

    private final JdbcTemplate jdbc;

    public HrCatalogRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Theo tên (không phân biệt hoa thường), kèm số nhân viên đang gán. */
    public List<CatalogItem> findAll(Kind k) {
        return jdbc.query("select c.id, c.name, (select count(*) from hr_employees e where e." + k.column() + " = c.id) n from "
                + k.table() + " c order by lower(c.name)", (rs, i) -> new CatalogItem(rs.getObject(1, UUID.class), rs.getString(2), rs.getInt(3)));
    }

    public void insert(Kind k, UUID id, String name) {
        jdbc.update("insert into " + k.table() + "(id, name) values (?, ?)", id, name);
    }

    /** Số dòng đã sửa (0 = không có). */
    public int rename(Kind k, UUID id, String name) {
        return jdbc.update("update " + k.table() + " set name = ? where id = ?", name, id);
    }

    /** Bỏ gán khỏi nhân viên rồi xóa; trả số dòng đã xóa. */
    public int delete(Kind k, UUID id) {
        jdbc.update("update hr_employees set " + k.column() + " = null where " + k.column() + " = ?", id);
        return jdbc.update("delete from " + k.table() + " where id = ?", id);
    }
}
