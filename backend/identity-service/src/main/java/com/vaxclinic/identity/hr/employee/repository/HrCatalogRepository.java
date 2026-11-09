package com.vaxclinic.identity.hr.employee.repository;

import com.vaxclinic.identity.hr.employee.dto.HrCatalogDtos.CatalogItem;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

/**
 * Bảng danh mục hr_departments / hr_job_titles (table) và cột tham chiếu trên hr_employees (column).
 * table / column là hằng số do HrCatalogService chọn, không lấy từ người dùng. Chỉ truy cập DB.
 */
@Repository
public class HrCatalogRepository {

    private final JdbcTemplate jdbc;

    public HrCatalogRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<CatalogItem> list(String table, String column) {
        return jdbc.query("select c.id, c.name, (select count(*) from hr_employees e where e." + column + " = c.id) n from "
                + table + " c order by lower(c.name)", (rs, i) -> new CatalogItem(rs.getObject(1, UUID.class), rs.getString(2), rs.getInt(3)));
    }

    /** Tên trùng → DuplicateKeyException. */
    public void insert(String table, UUID id, String name) {
        jdbc.update("insert into " + table + "(id, name) values (?, ?)", id, name);
    }

    /** Tên trùng → DuplicateKeyException. */
    public int rename(String table, UUID id, String name) {
        return jdbc.update("update " + table + " set name = ? where id = ?", name, id);
    }

    public void unassignEmployees(String column, UUID id) {
        jdbc.update("update hr_employees set " + column + " = null where " + column + " = ?", id);
    }

    public int delete(String table, UUID id) {
        return jdbc.update("delete from " + table + " where id = ?", id);
    }
}
