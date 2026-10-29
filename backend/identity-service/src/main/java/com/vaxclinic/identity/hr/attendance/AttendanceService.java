package com.vaxclinic.identity.hr.attendance;

import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.common.settings.ShopSettings;
import com.vaxclinic.identity.hr.HrActor;
import com.vaxclinic.identity.hr.attendance.AttendanceController.ApproveRequest;
import com.vaxclinic.identity.hr.attendance.AttendanceController.ManualRequest;
import com.vaxclinic.identity.hr.attendance.AttendanceQuery.Cell;
import com.vaxclinic.identity.hr.employee.EmployeeRepository;
import com.vaxclinic.identity.hr.schedule.Shift;
import com.vaxclinic.identity.hr.schedule.ShiftRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Bảng chấm công: lưới tối đa 2 tháng, sửa tay giờ vào-ra / nghỉ (ca qua đêm: giờ trước giờ bắt đầu ca → sang ngày hôm sau),
 * xóa, Duyệt chấm công (chỉ ô đã duyệt được tính lương). Mỗi thao tác ghi Lịch sử thao tác.
 */
@Service
public class AttendanceService {

    private final AttendanceQuery query;
    private final AttendanceWriter writer;
    private final AttendanceRepository attendance;
    private final ShiftRepository shifts;
    private final EmployeeRepository employees;
    private final AuditLogger audit;

    public AttendanceService(AttendanceQuery query, AttendanceWriter writer, AttendanceRepository attendance, ShiftRepository shifts,
                             EmployeeRepository employees, AuditLogger audit) {
        this.query = query;
        this.writer = writer;
        this.attendance = attendance;
        this.shifts = shifts;
        this.employees = employees;
        this.audit = audit;
    }

    public List<Cell> cells(LocalDate from, LocalDate to, UUID branchId, UUID employeeId) {
        if (ChronoUnit.DAYS.between(from, to) > 62 || to.isBefore(from)) {
            throw BusinessException.badRequest("INVALID_RANGE", "Khoảng thời gian tối đa 2 tháng");
        }
        return query.cells(from, to, branchId, employeeId);
    }

    @Transactional
    public Cell save(ManualRequest req, HrActor actor) {
        Shift sh = shifts.findAll().stream().filter(s -> s.id().equals(req.shiftId())).findFirst()
                .orElseThrow(() -> BusinessException.notFound("SHIFT_NOT_FOUND", "Không tìm thấy ca làm việc"));
        String name = employees.findName(req.employeeId());
        if (name == null) {
            throw BusinessException.notFound("EMPLOYEE_NOT_FOUND", "Không tìm thấy nhân viên");
        }
        boolean overnight = !sh.endTime().isAfter(sh.startTime());
        Instant in = req.absence() != null ? null : at(req.date(), req.checkIn(), overnight && req.checkIn() != null
                && req.checkIn().isBefore(sh.startTime().minusHours(4)));
        Instant out = req.absence() != null || req.checkOut() == null ? null
                : at(req.date(), req.checkOut(), overnight && req.checkOut().isBefore(sh.startTime()));
        if (in != null && out != null && !out.isAfter(in)) {
            out = out.plus(1, ChronoUnit.DAYS);
        }
        writer.upsert(req.employeeId(), req.shiftId(), req.date(), in, out, req.absence(), HrActor.blankToNull(req.note()),
                req.approved(), "MANUAL", null);
        actor.audit(audit, "Chấm công", "Chấm công " + name + " ca " + sh.name() + " ngày " + req.date()
                + (req.absence() != null ? ": nghỉ " + ("PAID".equals(req.absence()) ? "có phép" : "không phép")
                : ": vào " + req.checkIn() + ", ra " + req.checkOut()));
        return query.cells(req.date(), req.date(), null, req.employeeId()).stream()
                .filter(c -> c.shiftId().equals(req.shiftId())).findFirst().orElseThrow();
    }

    public void delete(UUID id, HrActor actor) {
        if (attendance.delete(id) > 0) {
            actor.audit(audit, "Xóa", "Xóa chấm công");
        }
    }

    /** Duyệt các ô đã chấm đủ vào-ra hoặc nghỉ trong khoảng ngày (hoặc theo danh sách id). */
    @Transactional
    public Map<String, Integer> approve(ApproveRequest req, HrActor actor) {
        var targets = query.cells(req.from(), req.to(), req.branchId(), null).stream()
                .filter(c -> c.attendanceId() != null && !c.approved())
                .filter(c -> req.ids() == null || req.ids().isEmpty() || req.ids().contains(c.attendanceId()))
                .filter(c -> c.absence() != null || (c.checkIn() != null && c.checkOut() != null))
                .map(Cell::attendanceId).toList();
        targets.forEach(attendance::approve);
        actor.audit(audit, "Duyệt chấm công", "Duyệt " + targets.size() + " lượt chấm công từ " + req.from() + " đến " + req.to());
        return Map.of("approved", targets.size());
    }

    private static Instant at(LocalDate date, LocalTime time, boolean nextDay) {
        if (time == null) {
            return null;
        }
        return (nextDay ? date.plusDays(1) : date).atTime(time).atZone(ShopSettings.ZONE).toInstant();
    }
}
