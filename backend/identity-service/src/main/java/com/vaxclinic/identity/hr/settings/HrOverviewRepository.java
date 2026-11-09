package com.vaxclinic.identity.hr.settings;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import com.vaxclinic.identity.hr.settings.HrSettings.SetupOverview;

/** Đếm dữ liệu thật cho tiến độ Khởi tạo (6 bước) của Nhân viên → Thiết lập. Chỉ truy cập DB. */
@Repository
public class HrOverviewRepository {

    private final JdbcTemplate jdbc;

    public HrOverviewRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public SetupOverview overview() {
        return new SetupOverview(
                count("select count(*) from hr_employees where status = 'WORKING'"),
                count("select count(*) from hr_shifts where active"),
                count("select count(*) from hr_schedules"),
                count("select count(*) from app_settings where key in ('hr.mobile', 'hr.timekeeping')")
                        + count("select count(*) from hr_attendance where source in ('PHONE', 'MACHINE')"),
                count("select count(*) from hr_employees where salary_type is not null"),
                count("select count(*) from hr_payrolls where status <> 'CANCELLED'"));
    }

    private long count(String sql) {
        Long n = jdbc.queryForObject(sql, Long.class);
        return n == null ? 0 : n;
    }
}
