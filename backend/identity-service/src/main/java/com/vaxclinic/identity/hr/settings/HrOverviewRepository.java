package com.vaxclinic.identity.hr.settings;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.Map;

/** Đếm dữ liệu thật cho tiến độ Khởi tạo (6 bước) của Nhân viên → Thiết lập. Chỉ truy cập DB. */
@Repository
public class HrOverviewRepository {

    private final JdbcTemplate jdbc;

    public HrOverviewRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Map<String, Object> overview() {
        return Map.of(
                "employees", count("select count(*) from hr_employees where status = 'WORKING'"),
                "shifts", count("select count(*) from hr_shifts where active"),
                "schedules", count("select count(*) from hr_schedules"),
                "timekeeping", count("select count(*) from app_settings where key in ('hr.mobile', 'hr.timekeeping')")
                        + count("select count(*) from hr_attendance where source in ('PHONE', 'MACHINE')"),
                "salaries", count("select count(*) from hr_employees where salary_type is not null"),
                "payrolls", count("select count(*) from hr_payrolls where status <> 'CANCELLED'"));
    }

    private long count(String sql) {
        Long n = jdbc.queryForObject(sql, Long.class);
        return n == null ? 0 : n;
    }
}
