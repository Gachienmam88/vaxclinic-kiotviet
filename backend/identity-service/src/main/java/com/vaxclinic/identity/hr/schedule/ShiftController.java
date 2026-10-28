package com.vaxclinic.identity.hr.schedule;

import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.identity.hr.HrActor;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

/** Ca làm việc (Thiết lập chấm công → Thiết lập ca làm việc, nút "+" ở Bảng chấm công). */
@RestController
@RequestMapping("/api/hr/shifts")
@PreAuthorize("hasAuthority('hr.manage')")
public class ShiftController {

    /** minutes: độ dài ca (ca qua đêm tính sang ngày hôm sau). */
    public record Shift(UUID id, String name, LocalTime startTime, LocalTime endTime, boolean active, int minutes) {
        public static int minutes(LocalTime start, LocalTime end) {
            long m = Duration.between(start, end).toMinutes();
            return (int) (m <= 0 ? m + 1440 : m);
        }
    }

    public record ShiftRequest(@NotBlank @Size(max = 100) String name, @NotNull LocalTime startTime, @NotNull LocalTime endTime,
                               Boolean active) {
    }

    private final JdbcTemplate jdbc;
    private final AuditLogger audit;

    public ShiftController(JdbcTemplate jdbc, AuditLogger audit) {
        this.jdbc = jdbc;
        this.audit = audit;
    }

    public static List<Shift> load(JdbcTemplate jdbc) {
        return jdbc.query("select id, name, start_time, end_time, active from hr_shifts order by start_time, name", (rs, i) -> {
            LocalTime s = rs.getObject(3, LocalTime.class);
            LocalTime e = rs.getObject(4, LocalTime.class);
            return new Shift(rs.getObject(1, UUID.class), rs.getString(2), s, e, rs.getBoolean(5), Shift.minutes(s, e));
        });
    }

    @GetMapping
    public List<Shift> list() {
        return load(jdbc);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Shift create(@Valid @RequestBody ShiftRequest req, @AuthenticationPrincipal Jwt jwt) {
        check(req);
        UUID id = UUID.randomUUID();
        jdbc.update("insert into hr_shifts(id, name, start_time, end_time, active) values (?,?,?,?,?)", id, req.name().trim(),
                req.startTime(), req.endTime(), req.active() == null || req.active());
        HrActor.of(jwt).audit(audit, "Tạo", "Tạo ca làm việc " + req.name().trim() + " (" + req.startTime() + " - " + req.endTime() + ")");
        return find(id);
    }

    @PutMapping("/{id}")
    public Shift update(@PathVariable UUID id, @Valid @RequestBody ShiftRequest req, @AuthenticationPrincipal Jwt jwt) {
        check(req);
        if (jdbc.update("update hr_shifts set name = ?, start_time = ?, end_time = ?, active = ? where id = ?", req.name().trim(),
                req.startTime(), req.endTime(), req.active() == null || req.active(), id) == 0) {
            throw BusinessException.notFound("SHIFT_NOT_FOUND", "Không tìm thấy ca làm việc");
        }
        HrActor.of(jwt).audit(audit, "Sửa", "Cập nhật ca làm việc " + req.name().trim() + " (" + req.startTime() + " - " + req.endTime() + ")");
        return find(id);
    }

    /** Ca đã dùng (lịch / chấm công) chỉ ngừng hoạt động, không xóa hẳn. */
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        Shift s = find(id);
        Long used = jdbc.queryForObject("select (select count(*) from hr_schedules where shift_id = ?) + (select count(*) from hr_attendance where shift_id = ?)",
                Long.class, id, id);
        if (used != null && used > 0) {
            jdbc.update("update hr_shifts set active = false where id = ?", id);
        } else {
            jdbc.update("delete from hr_shifts where id = ?", id);
        }
        HrActor.of(jwt).audit(audit, "Xóa", "Xóa ca làm việc " + s.name());
    }

    private static void check(ShiftRequest req) {
        if (req.startTime().equals(req.endTime())) {
            throw BusinessException.badRequest("INVALID_SHIFT", "Giờ kết thúc ca phải khác giờ bắt đầu");
        }
    }

    private Shift find(UUID id) {
        return load(jdbc).stream().filter(s -> s.id().equals(id)).findFirst()
                .orElseThrow(() -> BusinessException.notFound("SHIFT_NOT_FOUND", "Không tìm thấy ca làm việc"));
    }
}
