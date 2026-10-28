package com.vaxclinic.identity.hr.attendance;

import com.vaxclinic.identity.hr.settings.HrSettings.Timekeeping;
import com.vaxclinic.identity.hr.settings.HrSettingsService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/** Ô chấm công = lịch làm việc ∪ bản ghi chấm công (chấm công không cần xếp lịch) trong khoảng ngày, kèm kết quả đánh giá. */
@Component
public class AttendanceQuery {

    public record Cell(UUID attendanceId, UUID scheduleId, UUID employeeId, String employeeCode, String employeeName,
                       UUID shiftId, String shiftName, LocalTime shiftStart, LocalTime shiftEnd, LocalDate date,
                       Instant checkIn, Instant checkOut, String absence, boolean approved, String source, String note,
                       String status, int workedMinutes, int lateMinutes, int earlyMinutes, int otMinutes) {
    }

    private final JdbcTemplate jdbc;
    private final HrSettingsService settings;

    public AttendanceQuery(JdbcTemplate jdbc, HrSettingsService settings) {
        this.jdbc = jdbc;
        this.settings = settings;
    }

    public List<Cell> cells(LocalDate from, LocalDate to, UUID branchId, UUID employeeId) {
        return cells(from, to, branchId, employeeId, settings.timekeeping(), settings.payroll().hourMode());
    }

    public List<Cell> cells(LocalDate from, LocalDate to, UUID branchId, UUID employeeId, Timekeeping tk, String hourMode) {
        var args = new ArrayList<Object>(List.of(from, to, from, to));
        var where = new StringBuilder();
        if (employeeId != null) {
            where.append(" and e.id = ?");
            args.add(employeeId);
        }
        if (branchId != null) {
            where.append(" and (e.main_branch_id = ? or exists (select 1 from hr_employee_branches b where b.employee_id = e.id and b.branch_id = ?))");
            args.add(branchId);
            args.add(branchId);
        }
        return jdbc.query("""
                with k as (
                  select employee_id, shift_id, work_date from hr_schedules where work_date between ? and ?
                  union select employee_id, shift_id, work_date from hr_attendance where work_date between ? and ?)
                select k.employee_id, k.shift_id, k.work_date, s.id schedule_id, a.id attendance_id, a.check_in, a.check_out,
                  a.absence, coalesce(a.approved, false) approved, a.source, a.note, e.code, e.name,
                  sh.name shift_name, sh.start_time, sh.end_time
                from k join hr_employees e on e.id = k.employee_id join hr_shifts sh on sh.id = k.shift_id
                left join hr_schedules s on s.employee_id = k.employee_id and s.shift_id = k.shift_id and s.work_date = k.work_date
                left join hr_attendance a on a.employee_id = k.employee_id and a.shift_id = k.shift_id and a.work_date = k.work_date
                where 1=1""" + where + " order by k.work_date, sh.start_time, e.name", (rs, i) -> {
            LocalDate date = rs.getObject("work_date", LocalDate.class);
            LocalTime start = rs.getObject("start_time", LocalTime.class);
            LocalTime end = rs.getObject("end_time", LocalTime.class);
            Instant in = instant(rs.getTimestamp("check_in"));
            Instant out = instant(rs.getTimestamp("check_out"));
            String absence = rs.getString("absence");
            var ev = AttendanceRules.evaluate(date, start, end, in, out, absence, tk, hourMode);
            return new Cell(rs.getObject("attendance_id", UUID.class), rs.getObject("schedule_id", UUID.class),
                    rs.getObject("employee_id", UUID.class), rs.getString("code"), rs.getString("name"),
                    rs.getObject("shift_id", UUID.class), rs.getString("shift_name"), start, end, date, in, out, absence,
                    rs.getBoolean("approved"), rs.getString("source"), rs.getString("note"),
                    ev.status(), ev.workedMinutes(), ev.lateMinutes(), ev.earlyMinutes(), ev.otMinutes());
        }, args.toArray());
    }

    private static Instant instant(Timestamp t) {
        return t == null ? null : t.toInstant();
    }
}
