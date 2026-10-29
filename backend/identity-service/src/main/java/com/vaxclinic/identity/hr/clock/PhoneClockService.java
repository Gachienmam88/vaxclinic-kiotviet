package com.vaxclinic.identity.hr.clock;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.common.settings.ShopSettings;
import com.vaxclinic.identity.hr.attendance.AttendanceWriter;
import com.vaxclinic.identity.hr.attendance.AttendanceRepository.Existing;
import com.vaxclinic.identity.hr.attendance.AttendanceWriter.Slot;
import com.vaxclinic.identity.hr.settings.HrSettings.Timekeeping;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

/**
 * Vào ca / Ra ca trên điện thoại. Vào ca: ca gần giờ hiện tại nhất chưa có giờ vào. Ra ca: ca đang mở (đã vào, chưa ra);
 * bật "chấm 1 lượt Vào - Ra khi làm nhiều ca liên tục" → tự đóng ca trước lúc hết ca và mở ca liền sau lúc bắt đầu ca.
 */
@Service
public class PhoneClockService {

    public record Result(UUID shiftId, String shiftName, LocalDate date, String message) {
    }

    private static final DateTimeFormatter HM = DateTimeFormatter.ofPattern("HH:mm").withZone(ShopSettings.ZONE);

    private final ClockRepository repo;
    private final AttendanceWriter writer;

    public PhoneClockService(ClockRepository repo, AttendanceWriter writer) {
        this.repo = repo;
        this.writer = writer;
    }

    @Transactional
    public Result checkIn(UUID emp, Instant now, UUID branchId, Timekeeping tk) {
        Slot slot = writer.pick(emp, now, tk.allowUnscheduled());
        if (slot == null) {
            throw BusinessException.badRequest("NO_SHIFT", "Không có ca làm việc nào phù hợp với thời điểm này");
        }
        Existing ex = writer.find(emp, slot.shift().id(), slot.date());
        if (ex != null && ex.in() != null) {
            throw BusinessException.badRequest("ALREADY_IN", "Bạn đã vào " + slot.shift().name() + " lúc " + HM.format(ex.in()));
        }
        guard(ex);
        writer.upsert(emp, slot.shift().id(), slot.date(), now, ex == null ? null : ex.out(), null, null, false, "PHONE", branchId);
        return new Result(slot.shift().id(), slot.shift().name(), slot.date(), "Đã vào " + slot.shift().name() + " lúc " + HM.format(now));
    }

    @Transactional
    public Result checkOut(UUID emp, Instant now, UUID branchId, Timekeeping tk) {
        LocalDate today = now.atZone(ShopSettings.ZONE).toLocalDate();
        var open = repo.latestOpenShift(emp, today, now);
        if (open.isEmpty()) {
            Slot slot = writer.pick(emp, now, tk.allowUnscheduled());
            if (slot == null) {
                throw BusinessException.badRequest("NO_SHIFT", "Không có ca làm việc nào phù hợp với thời điểm này");
            }
            Existing ex = writer.find(emp, slot.shift().id(), slot.date());
            guard(ex);
            writer.upsert(emp, slot.shift().id(), slot.date(), ex == null ? null : ex.in(), now, null, null, false, "PHONE", branchId);
            return new Result(slot.shift().id(), slot.shift().name(), slot.date(),
                    "Đã ra " + slot.shift().name() + " lúc " + HM.format(now) + " (chưa có giờ vào ca)");
        }
        UUID shiftId = open.get(0).shiftId();
        LocalDate date = open.get(0).date();
        List<Slot> day = writer.scheduledSlots(emp, date, date);
        Slot current = day.stream().filter(s -> s.shift().id().equals(shiftId)).findFirst().orElse(null);
        if (current != null && tk.singleInOutMultiShift()) {
            for (Slot next : day.stream().sorted(Comparator.comparing(Slot::start)).toList()) {
                if (next.start().equals(current.end()) && next.start().isBefore(now)) {
                    Existing cur = writer.find(emp, current.shift().id(), date);
                    writer.upsert(emp, current.shift().id(), date, cur.in(), current.end(), null, null, false, "PHONE", branchId);
                    Existing nx = writer.find(emp, next.shift().id(), date);
                    guard(nx);
                    writer.upsert(emp, next.shift().id(), date, next.start(), null, null, null, false, "PHONE", branchId);
                    current = next;
                }
            }
        }
        UUID target = current == null ? shiftId : current.shift().id();
        Existing ex = writer.find(emp, target, date);
        writer.upsert(emp, target, date, ex.in(), now, null, null, false, "PHONE", branchId);
        String name = repo.shiftName(target);
        return new Result(target, name, date, "Đã ra " + name + " lúc " + HM.format(now));
    }

    private static void guard(Existing ex) {
        if (ex != null && (ex.approved() || ex.absence() != null)) {
            throw BusinessException.badRequest("LOCKED", "Ca này đã được duyệt hoặc ghi nhận nghỉ, liên hệ quản lý để sửa");
        }
    }
}
