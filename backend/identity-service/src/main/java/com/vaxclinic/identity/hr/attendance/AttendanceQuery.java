package com.vaxclinic.identity.hr.attendance;

import com.vaxclinic.identity.hr.settings.HrSettings.Timekeeping;
import com.vaxclinic.identity.hr.settings.HrSettingsService;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
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

    private final AttendanceRepository repo;
    private final HrSettingsService settings;

    public AttendanceQuery(AttendanceRepository repo, HrSettingsService settings) {
        this.repo = repo;
        this.settings = settings;
    }

    public List<Cell> cells(LocalDate from, LocalDate to, UUID branchId, UUID employeeId) {
        return cells(from, to, branchId, employeeId, settings.timekeeping(), settings.payroll().hourMode());
    }

    public List<Cell> cells(LocalDate from, LocalDate to, UUID branchId, UUID employeeId, Timekeeping tk, String hourMode) {
        return repo.cells(from, to, branchId, employeeId).stream().map(r -> {
            var ev = AttendanceRules.evaluate(r.date(), r.shiftStart(), r.shiftEnd(), r.checkIn(), r.checkOut(), r.absence(), tk, hourMode);
            return new Cell(r.attendanceId(), r.scheduleId(), r.employeeId(), r.employeeCode(), r.employeeName(), r.shiftId(),
                    r.shiftName(), r.shiftStart(), r.shiftEnd(), r.date(), r.checkIn(), r.checkOut(), r.absence(), r.approved(),
                    r.source(), r.note(), ev.status(), ev.workedMinutes(), ev.lateMinutes(), ev.earlyMinutes(), ev.otMinutes());
        }).toList();
    }
}
