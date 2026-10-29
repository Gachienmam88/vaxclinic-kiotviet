package com.vaxclinic.identity.hr.clock;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Tra cứu cho chấm công điện thoại: nhân viên theo tài khoản, chi nhánh làm việc, tên chi nhánh, ca đang mở. Chỉ truy cập DB. */
@Repository
public class ClockRepository {

    /** Hồ sơ nhân viên đang làm việc gắn với tài khoản. */
    public record ClockEmployee(UUID id, String code, String name, UUID mainBranch) {
    }

    /** Ca đang mở (đã vào, chưa ra). */
    public record OpenShift(UUID shiftId, LocalDate date) {
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

    /** Ca đang mở gần nhất (hôm qua / hôm nay, chưa duyệt, không nghỉ) có giờ vào trước {@code now}; rỗng = không có. */
    public List<OpenShift> latestOpenShift(UUID employeeId, LocalDate today, Instant now) {
        return jdbc.query("""
                select a.shift_id, a.work_date from hr_attendance a where a.employee_id = ? and a.check_in is not null
                  and a.check_out is null and a.absence is null and not a.approved and a.work_date between ? and ? and a.check_in < ?
                order by a.check_in desc limit 1""", (rs, i) -> new OpenShift(rs.getObject(1, UUID.class), rs.getObject(2, LocalDate.class)),
                employeeId, today.minusDays(1), today, Timestamp.from(now));
    }

    public String shiftName(UUID shiftId) {
        return jdbc.queryForObject("select name from hr_shifts where id = ?", String.class, shiftId);
    }
}
