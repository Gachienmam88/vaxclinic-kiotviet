package com.vaxclinic.identity.hr.clock;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.UUID;

/** Tra cứu cho chấm công điện thoại: nhân viên theo tài khoản, chi nhánh làm việc, tên chi nhánh. Chỉ truy cập DB. */
@Repository
public class ClockRepository {

    /** Hồ sơ nhân viên đang làm việc gắn với tài khoản. */
    public record ClockEmployee(UUID id, String code, String name, UUID mainBranch) {
    }

    private final JdbcTemplate jdbc;

    public ClockRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** null = tài khoản chưa liên kết nhân viên đang làm việc. */
    public ClockEmployee findWorkingByUser(UUID userId) {
        return jdbc.query("select id, code, name, main_branch_id from hr_employees where user_id = ? and status = 'WORKING'",
                rs -> rs.next() ? new ClockEmployee(rs.getObject(1, UUID.class), rs.getString(2), rs.getString(3), rs.getObject(4, UUID.class)) : null,
                userId);
    }

    /** Nhân viên thuộc chi nhánh (chi nhánh làm việc hoặc chi nhánh chính). */
    public boolean worksAt(UUID employeeId, UUID branchId) {
        Boolean works = jdbc.queryForObject("select exists (select 1 from hr_employee_branches where employee_id = ? and branch_id = ?)"
                + " or exists (select 1 from hr_employees where id = ? and main_branch_id = ?)", Boolean.class, employeeId, branchId, employeeId, branchId);
        return Boolean.TRUE.equals(works);
    }

    /** null = không có chi nhánh. */
    public String branchName(UUID id) {
        return jdbc.query("select name from branches where id = ?", rs -> rs.next() ? rs.getString(1) : null, id);
    }
}
