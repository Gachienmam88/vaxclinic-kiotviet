package com.vaxclinic.identity.hr.attendance;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.common.settings.ShopSettings;
import com.vaxclinic.identity.hr.schedule.Shift;
import com.vaxclinic.identity.hr.schedule.ShiftRepository;
import com.vaxclinic.identity.hr.attendance.AttendanceRepository.Existing;
import org.springframework.stereotype.Component;

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

    private final AttendanceRepository repo;
    private final ShiftRepository shiftRepo;

    public AttendanceWriter(AttendanceRepository repo, ShiftRepository shiftRepo) {
        this.repo = repo;
        this.shiftRepo = shiftRepo;
    }

    public List<Slot> scheduledSlots(UUID employeeId, LocalDate from, LocalDate to) {
        var shifts = shiftRepo.findAll();
        return repo.scheduledShifts(employeeId, from, to).stream().map(r -> {
            Shift sh = shifts.stream().filter(s -> s.id().equals(r.shiftId())).findFirst().orElseThrow();
            return slot(sh, r.date());
        }).sorted(Comparator.comparing(Slot::start)).toList();
    }

    public static Slot slot(Shift sh, LocalDate d) {
        return new Slot(sh, d, AttendanceRules.shiftStart(d, sh.startTime()), AttendanceRules.shiftEnd(d, sh.startTime(), sh.endTime()));
    }

    /** Ca phù hợp nhất với giờ quét; null = không có ca nào trong khung. */
    public Slot pick(UUID employeeId, Instant at, boolean allowUnscheduled) {
        LocalDate d = at.atZone(ShopSettings.ZONE).toLocalDate();
        var candidates = new ArrayList<>(scheduledSlots(employeeId, d.minusDays(1), d));
        if (candidates.stream().noneMatch(s -> inWindow(s, at)) && allowUnscheduled) {
            for (Shift sh : shiftRepo.findAll()) {
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

    public Existing find(UUID employeeId, UUID shiftId, LocalDate date) {
        return repo.find(employeeId, shiftId, date);
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
            repo.insert(id, employeeId, shiftId, date, in, out, absence, approved, source, branchId, note);
            return id;
        }
        repo.update(ex.id(), in, out, absence, approved, source, branchId, note);
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
}
