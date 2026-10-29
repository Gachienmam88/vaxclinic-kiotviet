package com.vaxclinic.identity.hr.settings;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Đếm dữ liệu thật cho tiến độ Khởi tạo (Nhân viên → Thiết lập). Chỉ truy cập DB. */
@Repository
public class HrSetupProgressRepository {

    private final JdbcTemplate jdbc;

    public HrSetupProgressRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public long workingEmployees() {
        return count("select count(*) from hr_employees where status = 'WORKING'");
    }

    public long activeShifts() {
        return count("select count(*) from hr_shifts where active");
    }

    public long schedules() {
        return count("select count(*) from hr_schedules");
    }

    /** Đã lưu thiết lập chấm công / chấm công điện thoại. */
    public long timekeepingSettings() {
        return count("select count(*) from app_settings where key in ('hr.mobile', 'hr.timekeeping')");
    }

    /** Lượt chấm công từ điện thoại / máy chấm công. */
    public long deviceAttendance() {
        return count("select count(*) from hr_attendance where source in ('PHONE', 'MACHINE')");
    }

    public long employeesWithSalary() {
        return count("select count(*) from hr_employees where salary_type is not null");
    }

    public long activePayrolls() {
        return count("select count(*) from hr_payrolls where status <> 'CANCELLED'");
    }

    private long count(String sql) {
        Long n = jdbc.queryForObject(sql, Long.class);
        return n == null ? 0 : n;
    }
}
