package com.vaxclinic.identity.hr.schedule;

import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.identity.hr.HrActor;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
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
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Lịch làm việc: xếp ca cho nhân viên theo ngày (lặp hàng tuần), lưới tuần + Lương dự kiến, import từ file. */
@RestController
@RequestMapping("/api/hr/schedules")
@PreAuthorize("hasAuthority('hr.manage')")
public class ScheduleController {

    public record ScheduleItem(UUID id, UUID employeeId, UUID shiftId, LocalDate date) {
    }

    public record WeekView(List<ScheduleItem> items, Map<UUID, java.math.BigDecimal> expected) {
    }

    /** repeatWeekly: lặp các thứ trong weekdays (1 = Thứ hai … 7 = Chủ nhật) từ date tới until (tối đa 1 năm). */
    public record ScheduleRequest(@NotEmpty List<UUID> employeeIds, @NotEmpty List<UUID> shiftIds, @NotNull LocalDate date,
                                  boolean repeatWeekly, List<@Min(1) @Max(7) Integer> weekdays, LocalDate until) {
    }

    public record ImportRow(String employeeCode, LocalDate date, String shiftName) {
    }

    public record ImportRequest(@NotNull @Size(max = 5000) List<ImportRow> rows) {
    }

    private final JdbcTemplate jdbc;
    private final ExpectedSalaryCalculator expected;
    private final AuditLogger audit;

    public ScheduleController(JdbcTemplate jdbc, ExpectedSalaryCalculator expected, AuditLogger audit) {
        this.jdbc = jdbc;
        this.expected = expected;
        this.audit = audit;
    }

    @GetMapping
    public WeekView week(@RequestParam LocalDate from, @RequestParam LocalDate to) {
        if (to.isBefore(from) || ChronoUnit.DAYS.between(from, to) > 62) {
            throw BusinessException.badRequest("INVALID_RANGE", "Khoảng thời gian tối đa 2 tháng");
        }
        var items = jdbc.query("select id, employee_id, shift_id, work_date from hr_schedules where work_date between ? and ? order by work_date",
                (rs, i) -> new ScheduleItem(rs.getObject(1, UUID.class), rs.getObject(2, UUID.class), rs.getObject(3, UUID.class),
                        rs.getObject(4, LocalDate.class)), from, to);
        return new WeekView(items, expected.expected(from, to));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public Map<String, Integer> create(@Valid @RequestBody ScheduleRequest req, @AuthenticationPrincipal Jwt jwt) {
        var dates = new ArrayList<LocalDate>();
        if (req.repeatWeekly()) {
            LocalDate until = req.until() == null ? req.date().plusWeeks(4) : req.until();
            if (until.isBefore(req.date()) || ChronoUnit.DAYS.between(req.date(), until) > 366) {
                throw BusinessException.badRequest("INVALID_REPEAT", "Ngày kết thúc lặp phải sau ngày bắt đầu và trong vòng 1 năm");
            }
            List<Integer> days = req.weekdays() == null || req.weekdays().isEmpty() ? List.of(req.date().getDayOfWeek().getValue()) : req.weekdays();
            for (LocalDate d = req.date(); !d.isAfter(until); d = d.plusDays(1)) {
                if (days.contains(d.getDayOfWeek().getValue())) {
                    dates.add(d);
                }
            }
        } else {
            dates.add(req.date());
        }
        int created = 0;
        for (UUID emp : req.employeeIds()) {
            for (UUID shift : req.shiftIds()) {
                for (LocalDate d : dates) {
                    created += jdbc.update("insert into hr_schedules(id, employee_id, shift_id, work_date) values (?,?,?,?) on conflict do nothing",
                            UUID.randomUUID(), emp, shift, d);
                }
            }
        }
        HrActor.of(jwt).audit(audit, "Xếp lịch", "Xếp " + created + " ca làm việc cho " + req.employeeIds().size() + " nhân viên từ " + req.date());
        return Map.of("created", created);
    }

    /** repeat=true: xóa cả các ca cùng nhân viên, cùng ca, cùng thứ trong tuần từ ngày này trở đi. */
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void delete(@PathVariable UUID id, @RequestParam(defaultValue = "false") boolean repeat, @AuthenticationPrincipal Jwt jwt) {
        var s = jdbc.query("select employee_id, shift_id, work_date from hr_schedules where id = ?",
                (rs, i) -> new ScheduleItem(id, rs.getObject(1, UUID.class), rs.getObject(2, UUID.class), rs.getObject(3, LocalDate.class)), id);
        if (s.isEmpty()) {
            return;
        }
        ScheduleItem it = s.get(0);
        int n = repeat
                ? jdbc.update("delete from hr_schedules where employee_id = ? and shift_id = ? and work_date >= ? and extract(isodow from work_date) = ?",
                it.employeeId(), it.shiftId(), it.date(), it.date().getDayOfWeek().getValue())
                : jdbc.update("delete from hr_schedules where id = ?", id);
        HrActor.of(jwt).audit(audit, "Xóa lịch", "Xóa " + n + " ca làm việc từ ngày " + it.date());
    }

    /** Import lịch: mỗi dòng Mã nhân viên + Ngày + Tên ca (file do màn Lịch làm việc đọc và gửi lên). */
    @PostMapping("/import")
    @Transactional
    public Map<String, Object> importRows(@Valid @RequestBody ImportRequest req, @AuthenticationPrincipal Jwt jwt) {
        var errors = new ArrayList<String>();
        int created = 0;
        int line = 1;
        for (ImportRow r : req.rows()) {
            line++;
            UUID emp = r.employeeCode() == null ? null : jdbc.query("select id from hr_employees where upper(code) = upper(?)",
                    rs -> rs.next() ? rs.getObject(1, UUID.class) : null, r.employeeCode().trim());
            UUID shift = r.shiftName() == null ? null : jdbc.query("select id from hr_shifts where lower(name) = lower(?) and active",
                    rs -> rs.next() ? rs.getObject(1, UUID.class) : null, r.shiftName().trim());
            if (emp == null || shift == null || r.date() == null) {
                if (errors.size() < 50) {
                    errors.add("Dòng " + line + ": " + (emp == null ? "không tìm thấy mã nhân viên " + r.employeeCode()
                            : shift == null ? "không tìm thấy ca " + r.shiftName() : "thiếu ngày"));
                }
                continue;
            }
            created += jdbc.update("insert into hr_schedules(id, employee_id, shift_id, work_date) values (?,?,?,?) on conflict do nothing",
                    UUID.randomUUID(), emp, shift, r.date());
        }
        HrActor.of(jwt).audit(audit, "Import", "Import lịch làm việc: " + created + " ca");
        return Map.of("created", created, "errors", errors);
    }
}
