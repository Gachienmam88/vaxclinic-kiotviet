package com.vaxclinic.identity.hr.schedule.service;

import com.vaxclinic.identity.hr.schedule.dto.Shift;
import com.vaxclinic.identity.hr.schedule.repository.ShiftRepository;
import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.identity.hr.dto.HrActor;
import com.vaxclinic.identity.hr.schedule.dto.ScheduleDtos.ShiftRequest;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

/** Ca làm việc (Thiết lập chấm công → Thiết lập ca làm việc, nút "+" ở Bảng chấm công). */
@Service
public class ShiftService {

    private final ShiftRepository shifts;
    private final AuditLogger audit;

    public ShiftService(ShiftRepository shifts, AuditLogger audit) {
        this.shifts = shifts;
        this.audit = audit;
    }

    public List<Shift> list() {
        return shifts.findAll();
    }

    public Shift create(ShiftRequest req, HrActor actor) {
        check(req);
        UUID id = UUID.randomUUID();
        shifts.insert(id, req.name().trim(), req.startTime(), req.endTime(), req.active() == null || req.active());
        actor.audit(audit, "Tạo", "Tạo ca làm việc " + req.name().trim() + " (" + req.startTime() + " - " + req.endTime() + ")");
        return find(id);
    }

    public Shift update(UUID id, ShiftRequest req, HrActor actor) {
        check(req);
        if (shifts.update(id, req.name().trim(), req.startTime(), req.endTime(), req.active() == null || req.active()) == 0) {
            throw BusinessException.notFound("SHIFT_NOT_FOUND", "Không tìm thấy ca làm việc");
        }
        actor.audit(audit, "Sửa", "Cập nhật ca làm việc " + req.name().trim() + " (" + req.startTime() + " - " + req.endTime() + ")");
        return find(id);
    }

    /** Ca đã dùng (lịch / chấm công) chỉ ngừng hoạt động, không xóa hẳn. */
    public void delete(UUID id, HrActor actor) {
        Shift s = find(id);
        Long used = shifts.usageCount(id);
        if (used != null && used > 0) {
            shifts.deactivate(id);
        } else {
            shifts.delete(id);
        }
        actor.audit(audit, "Xóa", "Xóa ca làm việc " + s.name());
    }

    private static void check(ShiftRequest req) {
        if (req.startTime().equals(req.endTime())) {
            throw BusinessException.badRequest("INVALID_SHIFT", "Giờ kết thúc ca phải khác giờ bắt đầu");
        }
    }

    private Shift find(UUID id) {
        return shifts.findAll().stream().filter(s -> s.id().equals(id)).findFirst()
                .orElseThrow(() -> BusinessException.notFound("SHIFT_NOT_FOUND", "Không tìm thấy ca làm việc"));
    }
}
