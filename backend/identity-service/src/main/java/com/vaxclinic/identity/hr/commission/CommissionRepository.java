package com.vaxclinic.identity.hr.commission;

import com.vaxclinic.identity.hr.commission.CommissionDtos.Rule;
import com.vaxclinic.identity.hr.commission.CommissionDtos.Table;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/** Bảng hr_commission_tables / hr_commission_rules + nhân viên áp dụng (hr_employees.commission_table_id). Chỉ truy cập DB. */
@Repository
public class CommissionRepository {

    private final JdbcTemplate jdbc;

    public CommissionRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<Table> tables() {
        return jdbc.query("""
                select t.id, t.name, t.active, (select count(*) from hr_commission_rules r where r.table_id = t.id),
                  (select count(*) from hr_employees e where e.commission_table_id = t.id) from hr_commission_tables t order by lower(t.name)""",
                (rs, i) -> new Table(rs.getObject(1, UUID.class), rs.getString(2), rs.getBoolean(3), rs.getInt(4), rs.getInt(5)));
    }

    public List<Rule> rules() {
        return jdbc.query("select table_id, product_id, rate_type, value from hr_commission_rules",
                (rs, i) -> new Rule(rs.getObject(1, UUID.class), rs.getObject(2, UUID.class), rs.getString(3), rs.getBigDecimal(4)));
    }

    /** Tên trùng → DuplicateKeyException. */
    public void insertTable(UUID id, String name, boolean active) {
        jdbc.update("insert into hr_commission_tables(id, name, active) values (?,?,?)", id, name, active);
    }

    /** Tên trùng → DuplicateKeyException. */
    public int updateTable(UUID id, String name, boolean active) {
        return jdbc.update("update hr_commission_tables set name = ?, active = ? where id = ?", name, active, id);
    }

    public void deleteTable(UUID id) {
        jdbc.update("delete from hr_commission_tables where id = ?", id);
    }

    public void deleteRule(UUID tableId, UUID productId) {
        jdbc.update("delete from hr_commission_rules where table_id = ? and product_id = ?", tableId, productId);
    }

    public void upsertRule(UUID tableId, UUID productId, String rateType, BigDecimal value) {
        jdbc.update("""
                insert into hr_commission_rules(table_id, product_id, rate_type, value) values (?,?,?,?)
                on conflict (table_id, product_id) do update set rate_type = excluded.rate_type, value = excluded.value""",
                tableId, productId, rateType, value);
    }

    public List<UUID> employeeIds(UUID tableId) {
        return jdbc.queryForList("select id from hr_employees where commission_table_id = ? order by code", UUID.class, tableId);
    }

    public void clearEmployees(UUID tableId) {
        jdbc.update("update hr_employees set commission_table_id = null where commission_table_id = ?", tableId);
    }

    public void assignEmployee(UUID tableId, UUID employeeId) {
        jdbc.update("update hr_employees set commission_table_id = ? where id = ?", tableId, employeeId);
    }
}
