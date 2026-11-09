package com.vaxclinic.identity.hr.clock;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.UUID;

/** Tra cứu cho chấm công điện thoại: nhân viên theo tài khoản, chi nhánh. Chỉ truy cập DB. */
@Repository
public class ClockRepository {

    public record Emp(UUID id, String code, String name, UUID mainBranch) {
    }

    private final JdbcTemplate jdbc;

    public ClockRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Nhân viên đang làm việc liên kết với tài khoản; không có → null. */
    public Emp workingEmployeeOfUser(UUID userId) {
        return jdbc.query("select id, code, name, main_branch_id from hr_employees where user_id = ? and status = 'WORKING'",
                rs -> rs.next() ? new Emp(rs.getObject(1, UUID.class), rs.getString(2), rs.getString(3), rs.getObject(4, UUID.class)) : null,
                userId);
    }

    public Boolean worksAt(UUID employeeId, UUID branchId) {
        return jdbc.queryForObject("select exists (select 1 from hr_employee_branches where employee_id = ? and branch_id = ?)"
                + " or exists (select 1 from hr_employees where id = ? and main_branch_id = ?)", Boolean.class, employeeId, branchId, employeeId, branchId);
    }

    public String branchName(UUID id) {
        return jdbc.query("select name from branches where id = ?", rs -> rs.next() ? rs.getString(1) : null, id);
    }
}
