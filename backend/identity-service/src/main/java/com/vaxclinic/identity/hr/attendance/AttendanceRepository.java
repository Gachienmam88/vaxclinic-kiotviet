package com.vaxclinic.identity.hr.attendance;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Bảng hr_attendance (+ ca đã xếp hr_schedules dùng để ghép giờ quét). Ghép ca / đánh giá trạng thái nằm ở
 * {@link AttendanceWriter} / {@link AttendanceQuery}. Chỉ truy cập DB.
 */
@Repository
public class AttendanceRepository {

    /** Bản ghi chấm công hiện có của 1 ô (nhân viên, ca, ngày). */
    public record Existing(UUID id, Instant in, Instant out, String absence, boolean approved) {
    }

    /** Ca đã xếp của nhân viên trong 1 ngày. */
    public record ScheduledShift(UUID shiftId, LocalDate date) {
    }

    /** Dòng thô của ô chấm công (chưa đánh giá đi muộn / về sớm). */
    public record CellRow(UUID attendanceId, UUID scheduleId, UUID employeeId, String employeeCode, String employeeName,
                          UUID shiftId, String shiftName, LocalTime shiftStart, LocalTime shiftEnd, LocalDate date,
                          Instant checkIn, Instant checkOut, String absence, boolean approved, String source, String note) {
    }

    private final JdbcTemplate jdbc;

    public AttendanceRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Số dòng đã xóa. */
    public int delete(UUID id) {
        return jdbc.update("delete from hr_attendance where id = ?", id);
    }

    public void approve(UUID id) {
        jdbc.update("update hr_attendance set approved = true, updated_at = now() where id = ?", id);
    }

    /** Lịch làm việc ∪ chấm công trong khoảng ngày; lọc thêm theo nhân viên / chi nhánh nếu có. */
    public List<CellRow> cells(LocalDate from, LocalDate to, UUID branchId, UUID employeeId) {
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
                where 1=1""" + where + " order by k.work_date, sh.start_time, e.name", (rs, i) -> new CellRow(
                rs.getObject("attendance_id", UUID.class), rs.getObject("schedule_id", UUID.class),
                rs.getObject("employee_id", UUID.class), rs.getString("code"), rs.getString("name"),
                rs.getObject("shift_id", UUID.class), rs.getString("shift_name"), rs.getObject("start_time", LocalTime.class),
                rs.getObject("end_time", LocalTime.class), rs.getObject("work_date", LocalDate.class),
                ts(rs.getTimestamp("check_in")), ts(rs.getTimestamp("check_out")), rs.getString("absence"),
                rs.getBoolean("approved"), rs.getString("source"), rs.getString("note")), args.toArray());
    }

    public List<ScheduledShift> scheduledShifts(UUID employeeId, LocalDate from, LocalDate to) {
        return jdbc.query("select shift_id, work_date from hr_schedules where employee_id = ? and work_date between ? and ?",
                (rs, i) -> new ScheduledShift(rs.getObject(1, UUID.class), rs.getObject(2, LocalDate.class)), employeeId, from, to);
    }

    /** null = ô chưa có bản ghi chấm công. */
    public Existing find(UUID employeeId, UUID shiftId, LocalDate date) {
        return jdbc.query("select id, check_in, check_out, absence, approved from hr_attendance where employee_id = ? and shift_id = ? and work_date = ?",
                rs -> rs.next() ? new Existing(rs.getObject(1, UUID.class), ts(rs.getTimestamp(2)), ts(rs.getTimestamp(3)),
                        rs.getString(4), rs.getBoolean(5)) : null, employeeId, shiftId, date);
    }

    public void insert(UUID id, UUID employeeId, UUID shiftId, LocalDate date, Instant in, Instant out, String absence,
                       boolean approved, String source, UUID branchId, String note) {
        jdbc.update("""
                insert into hr_attendance(id, employee_id, shift_id, work_date, check_in, check_out, absence, approved, source, branch_id, note)
                values (?,?,?,?,?,?,?,?,?,?,?)""", id, employeeId, shiftId, date, t(in), t(out), absence, approved, source, branchId, note);
    }

    /** branchId null = giữ chi nhánh cũ. */
    public void update(UUID id, Instant in, Instant out, String absence, boolean approved, String source, UUID branchId, String note) {
        jdbc.update("""
                update hr_attendance set check_in = ?, check_out = ?, absence = ?, approved = ?, source = ?,
                  branch_id = coalesce(?, branch_id), note = ?, updated_at = now() where id = ?""",
                t(in), t(out), absence, approved, source, branchId, note, id);
    }

    private static Timestamp t(Instant i) {
        return i == null ? null : Timestamp.from(i);
    }

    private static Instant ts(Timestamp t) {
        return t == null ? null : t.toInstant();
    }
}
