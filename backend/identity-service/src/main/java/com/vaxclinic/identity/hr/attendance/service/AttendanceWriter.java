package com.vaxclinic.identity.hr.attendance.service;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.common.settings.ShopSettings;
import com.vaxclinic.identity.hr.schedule.dto.Shift;
import com.vaxclinic.identity.hr.schedule.repository.ShiftRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

/**
 * Ghi chấm công: sửa tay trên lưới, ghép giờ quét (điện thoại / máy chấm công) vào đúng ca.
 * Ghép ca: ưu tiên ca đã xếp lịch (hôm qua với ca qua đêm, hôm nay) có khung [bắt đầu − 4h, kết thúc + 4h] chứa giờ quét;
 * không có lịch mà bật "Chấm công không cần xếp lịch" → ca đang hoạt động gần nhất.
 */
@Component
public class AttendanceWriter {

    /** Ca ứng viên cho 1 lần quét. */
    public record Slot(Shift shift, LocalDate date, Instant start, Instant end) {
        long distance(Instant at) {
            if (at.isBefore(start)) {
                return Duration.between(at, start).toSeconds();
            }
            return at.isAfter(end) ? Duration.between(end, at).toSeconds() : 0;
        }
    }

    private static final Duration WINDOW = Duration.ofHours(4);

    private final JdbcTemplate jdbc;

    public AttendanceWriter(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<Slot> scheduledSlots(UUID employeeId, LocalDate from, LocalDate to) {
        var shifts = ShiftRepository.load(jdbc);
        return jdbc.query("select shift_id, work_date from hr_schedules where employee_id = ? and work_date between ? and ?", (rs, i) -> {
            UUID sid = rs.getObject(1, UUID.class);
            Shift sh = shifts.stream().filter(s -> s.id().equals(sid)).findFirst().orElseThrow();
            LocalDate d = rs.getObject(2, LocalDate.class);
            return slot(sh, d);
        }, employeeId, from, to).stream().sorted(Comparator.comparing(Slot::start)).toList();
    }

    public static Slot slot(Shift sh, LocalDate d) {
        return new Slot(sh, d, AttendanceRules.shiftStart(d, sh.startTime()), AttendanceRules.shiftEnd(d, sh.startTime(), sh.endTime()));
    }

    /** Ca phù hợp nhất với giờ quét; null = không có ca nào trong khung. */
    public Slot pick(UUID employeeId, Instant at, boolean allowUnscheduled) {
        LocalDate d = at.atZone(ShopSettings.ZONE).toLocalDate();
        var candidates = new ArrayList<>(scheduledSlots(employeeId, d.minusDays(1), d));
        if (candidates.stream().noneMatch(s -> inWindow(s, at)) && allowUnscheduled) {
            for (Shift sh : ShiftRepository.load(jdbc)) {
                if (sh.active()) {
                    candidates.add(slot(sh, d));
                    candidates.add(slot(sh, d.minusDays(1)));
                }
            }
        }
        return candidates.stream().filter(s -> inWindow(s, at))
                .min(Comparator.comparingLong((Slot s) -> s.distance(at)).thenComparing(Slot::start)).orElse(null);
    }

    private static boolean inWindow(Slot s, Instant at) {
        return !at.isBefore(s.start().minus(WINDOW)) && !at.isAfter(s.end().plus(WINDOW));
    }

    public record Existing(UUID id, Instant in, Instant out, String absence, boolean approved) {
    }

    public Existing find(UUID employeeId, UUID shiftId, LocalDate date) {
        return jdbc.query("select id, check_in, check_out, absence, approved from hr_attendance where employee_id = ? and shift_id = ? and work_date = ?",
                rs -> rs.next() ? new Existing(rs.getObject(1, UUID.class), ts(rs.getTimestamp(2)), ts(rs.getTimestamp(3)),
                        rs.getString(4), rs.getBoolean(5)) : null, employeeId, shiftId, date);
    }

    /** Ghi đè toàn bộ giá trị ô (sửa tay). */
    public UUID upsert(UUID employeeId, UUID shiftId, LocalDate date, Instant in, Instant out, String absence, String note,
                       boolean approved, String source, UUID branchId) {
        if (in != null && out != null && !out.isAfter(in)) {
            throw BusinessException.badRequest("INVALID_TIME", "Giờ ra phải sau giờ vào");
        }
        Existing ex = find(employeeId, shiftId, date);
        if (ex == null) {
            UUID id = UUID.randomUUID();
            jdbc.update("""
                    insert into hr_attendance(id, employee_id, shift_id, work_date, check_in, check_out, absence, approved, source, branch_id, note)
                    values (?,?,?,?,?,?,?,?,?,?,?)""", id, employeeId, shiftId, date, t(in), t(out), absence, approved, source, branchId, note);
            return id;
        }
        jdbc.update("""
                update hr_attendance set check_in = ?, check_out = ?, absence = ?, approved = ?, source = ?,
                  branch_id = coalesce(?, branch_id), note = ?, updated_at = now() where id = ?""",
                t(in), t(out), absence, approved, source, branchId, note, ex.id());
        return ex.id();
    }

    /** Ghép thêm giờ quét: giờ vào = sớm nhất, giờ ra = muộn nhất (bản ghi đã duyệt / nghỉ thì giữ nguyên). */
    public boolean merge(Slot slot, UUID employeeId, Instant in, Instant out, String source, UUID branchId) {
        Existing ex = find(employeeId, slot.shift().id(), slot.date());
        if (ex != null && (ex.approved() || ex.absence() != null)) {
            return false;
        }
        Instant newIn = min(ex == null ? null : ex.in(), in);
        Instant newOut = max(ex == null ? null : ex.out(), out);
        if (newIn != null && newOut != null && !newOut.isAfter(newIn)) {
            newOut = null;
        }
        upsert(employeeId, slot.shift().id(), slot.date(), newIn, newOut, null, null, false, source, branchId);
        return true;
    }

    private static Instant min(Instant a, Instant b) {
        return a == null ? b : b == null ? a : a.isBefore(b) ? a : b;
    }

    private static Instant max(Instant a, Instant b) {
        return a == null ? b : b == null ? a : a.isAfter(b) ? a : b;
    }

    static Timestamp t(Instant i) {
        return i == null ? null : Timestamp.from(i);
    }

    static Instant ts(Timestamp t) {
        return t == null ? null : t.toInstant();
    }
}
