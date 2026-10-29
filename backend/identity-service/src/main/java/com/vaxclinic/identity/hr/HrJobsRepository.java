package com.vaxclinic.identity.hr;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Tra cứu cho việc nền Nhân viên ({@link HrJobs}): bảng lương theo kỳ, ca đã xếp chưa chấm công. Chỉ truy cập DB. */
@Repository
public class HrJobsRepository {

    /** Ca đã xếp của nhân viên đang làm việc mà chưa có bản ghi chấm công. */
    public record UnclockedShift(UUID employeeId, UUID shiftId, LocalDate workDate, UUID mainBranchId) {
    }

    private final JdbcTemplate jdbc;

    public HrJobsRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Số bảng lương chưa hủy bắt đầu đúng ngày {@code periodStart}. */
    public Long countActivePayrolls(LocalDate periodStart) {
        return jdbc.queryForObject("select count(*) from hr_payrolls where period_start = ? and status <> 'CANCELLED'",
                Long.class, periodStart);
    }

    /** Số nhân viên đang làm việc đã thiết lập lương. */
    public Long countSalariedWorkingEmployees() {
        return jdbc.queryForObject("select count(*) from hr_employees where salary_type is not null and status = 'WORKING'", Long.class);
    }

    /** Bảng lương Tạm tính có kỳ kết thúc từ {@code since}. */
    public List<UUID> tempPayrollIdsEndingFrom(LocalDate since) {
        return jdbc.queryForList("select id from hr_payrolls where status = 'TEMP' and period_end >= ?", UUID.class, since);
    }

    public List<UnclockedShift> unclockedShifts(LocalDate from, LocalDate to) {
        return jdbc.query("""
                select s.employee_id, s.shift_id, s.work_date, e.main_branch_id from hr_schedules s join hr_employees e on e.id = s.employee_id
                where s.work_date between ? and ? and e.status = 'WORKING' and not exists (select 1 from hr_attendance a
                  where a.employee_id = s.employee_id and a.shift_id = s.shift_id and a.work_date = s.work_date)""",
                (rs, i) -> new UnclockedShift(rs.getObject(1, UUID.class), rs.getObject(2, UUID.class),
                        rs.getObject(3, LocalDate.class), rs.getObject(4, UUID.class)), from, to);
    }
}
