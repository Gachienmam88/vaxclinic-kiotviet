package com.vaxclinic.identity.hr.attendance;

import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.identity.hr.HrActor;
import com.vaxclinic.identity.hr.attendance.AttendanceQuery.Cell;
import com.vaxclinic.identity.hr.schedule.ShiftController;
import com.vaxclinic.identity.hr.schedule.ShiftController.Shift;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Bảng chấm công: lưới theo ca / nhân viên, sửa tay giờ vào-ra / nghỉ, Duyệt chấm công. */
@RestController
@RequestMapping("/api/hr/attendance")
@PreAuthorize("hasAuthority('hr.manage')")
public class AttendanceController {

    /** checkIn / checkOut: giờ "HH:mm" trong ngày làm việc (ca qua đêm: giờ trước giờ bắt đầu ca → sang ngày hôm sau). */
    public record ManualRequest(@NotNull UUID employeeId, @NotNull UUID shiftId, @NotNull LocalDate date,
                                LocalTime checkIn, LocalTime checkOut, @Pattern(regexp = "PAID|UNPAID") String absence,
                                @Size(max = 300) String note, boolean approved) {
    }

    public record ApproveRequest(@NotNull LocalDate from, @NotNull LocalDate to, UUID branchId, List<UUID> ids) {
    }

    private final AttendanceQuery query;
    private final AttendanceWriter writer;
    private final JdbcTemplate jdbc;
    private final AuditLogger audit;

    public AttendanceController(AttendanceQuery query, AttendanceWriter writer, JdbcTemplate jdbc, AuditLogger audit) {
        this.query = query;
        this.writer = writer;
        this.jdbc = jdbc;
        this.audit = audit;
    }

    @GetMapping
    public List<Cell> cells(@RequestParam LocalDate from, @RequestParam LocalDate to,
                            @RequestParam(required = false) UUID branchId, @RequestParam(required = false) UUID employeeId) {
        if (ChronoUnit.DAYS.between(from, to) > 62 || to.isBefore(from)) {
            throw BusinessException.badRequest("INVALID_RANGE", "Khoảng thời gian tối đa 2 tháng");
        }
        return query.cells(from, to, branchId, employeeId);
    }

    @PutMapping
    @Transactional
    public Cell save(@Valid @RequestBody ManualRequest req, @AuthenticationPrincipal Jwt jwt) {
        Shift sh = ShiftController.load(jdbc).stream().filter(s -> s.id().equals(req.shiftId())).findFirst()
                .orElseThrow(() -> BusinessException.notFound("SHIFT_NOT_FOUND", "Không tìm thấy ca làm việc"));
        String name = jdbc.query("select name from hr_employees where id = ?", rs -> rs.next() ? rs.getString(1) : null, req.employeeId());
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
        HrActor.of(jwt).audit(audit, "Chấm công", "Chấm công " + name + " ca " + sh.name() + " ngày " + req.date()
                + (req.absence() != null ? ": nghỉ " + ("PAID" .equals(req.absence()) ? "có phép" : "không phép")
                : ": vào " + req.checkIn() + ", ra " + req.checkOut()));
        return query.cells(req.date(), req.date(), null, req.employeeId()).stream()
                .filter(c -> c.shiftId().equals(req.shiftId())).findFirst().orElseThrow();
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        if (jdbc.update("delete from hr_attendance where id = ?", id) > 0) {
            HrActor.of(jwt).audit(audit, "Xóa", "Xóa chấm công");
        }
    }

    /** Duyệt các ô đã chấm đủ vào-ra hoặc nghỉ trong khoảng ngày (hoặc theo danh sách id). Chỉ ô đã duyệt được tính lương. */
    @PostMapping("/approve")
    @Transactional
    public Map<String, Integer> approve(@Valid @RequestBody ApproveRequest req, @AuthenticationPrincipal Jwt jwt) {
        var targets = query.cells(req.from(), req.to(), req.branchId(), null).stream()
                .filter(c -> c.attendanceId() != null && !c.approved())
                .filter(c -> req.ids() == null || req.ids().isEmpty() || req.ids().contains(c.attendanceId()))
                .filter(c -> c.absence() != null || (c.checkIn() != null && c.checkOut() != null))
                .map(Cell::attendanceId).toList();
        targets.forEach(id -> jdbc.update("update hr_attendance set approved = true, updated_at = now() where id = ?", id));
        HrActor.of(jwt).audit(audit, "Duyệt chấm công", "Duyệt " + targets.size() + " lượt chấm công từ " + req.from() + " đến " + req.to());
        return Map.of("approved", targets.size());
    }

    private static Instant at(LocalDate date, LocalTime time, boolean nextDay) {
        if (time == null) {
            return null;
        }
        return (nextDay ? date.plusDays(1) : date).atTime(time).atZone(com.vaxclinic.common.settings.ShopSettings.ZONE).toInstant();
    }
}
