package com.vaxclinic.identity.hr.schedule;

import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.identity.hr.HrActor;
import com.vaxclinic.identity.hr.employee.EmployeeRepository;
import com.vaxclinic.identity.hr.schedule.ScheduleModels.ImportRow;
import com.vaxclinic.identity.hr.schedule.ScheduleModels.ScheduleItem;
import com.vaxclinic.identity.hr.schedule.ScheduleModels.ScheduleRequest;
import com.vaxclinic.identity.hr.schedule.ScheduleModels.WeekView;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Lịch làm việc: lưới tối đa 2 tháng + Lương dự kiến, xếp ca (lặp hàng tuần tối đa 1 năm), xóa, import từ file.
 * Ca đã xếp trùng thì bỏ qua. Mỗi thao tác ghi Lịch sử thao tác.
 */
@Service
public class ScheduleService {

    private final ScheduleRepository schedules;
    private final ShiftRepository shifts;
    private final EmployeeRepository employees;
    private final ExpectedSalaryCalculator expected;
    private final AuditLogger audit;

    public ScheduleService(ScheduleRepository schedules, ShiftRepository shifts, EmployeeRepository employees,
                           ExpectedSalaryCalculator expected, AuditLogger audit) {
        this.schedules = schedules;
        this.shifts = shifts;
        this.employees = employees;
        this.expected = expected;
        this.audit = audit;
    }

    public WeekView week(LocalDate from, LocalDate to) {
        if (to.isBefore(from) || ChronoUnit.DAYS.between(from, to) > 62) {
            throw BusinessException.badRequest("INVALID_RANGE", "Khoảng thời gian tối đa 2 tháng");
        }
        return new WeekView(schedules.findBetween(from, to), expected.expected(from, to));
    }

    @Transactional
    public Map<String, Integer> create(ScheduleRequest req, HrActor actor) {
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
                    created += schedules.insertIfAbsent(emp, shift, d);
                }
            }
        }
        actor.audit(audit, "Xếp lịch", "Xếp " + created + " ca làm việc cho " + req.employeeIds().size() + " nhân viên từ " + req.date());
        return Map.of("created", created);
    }

    /** repeat=true: xóa cả các ca cùng nhân viên, cùng ca, cùng thứ trong tuần từ ngày này trở đi. Không có → bỏ qua. */
    @Transactional
    public void delete(UUID id, boolean repeat, HrActor actor) {
        var found = schedules.findById(id);
        if (found.isEmpty()) {
            return;
        }
        ScheduleItem it = found.get();
        int n = repeat ? schedules.deleteWeeklyFrom(it.employeeId(), it.shiftId(), it.date()) : schedules.delete(id);
        actor.audit(audit, "Xóa lịch", "Xóa " + n + " ca làm việc từ ngày " + it.date());
    }

    /** Import lịch: mỗi dòng Mã nhân viên + Ngày + Tên ca; lỗi trả tối đa 50 dòng. */
    @Transactional
    public Map<String, Object> importRows(List<ImportRow> rows, HrActor actor) {
        var errors = new ArrayList<String>();
        int created = 0;
        int line = 1;
        for (ImportRow r : rows) {
            line++;
            UUID emp = r.employeeCode() == null ? null : employees.findIdByCode(r.employeeCode().trim());
            UUID shift = r.shiftName() == null ? null : shifts.findActiveIdByName(r.shiftName().trim());
            if (emp == null || shift == null || r.date() == null) {
                if (errors.size() < 50) {
                    errors.add("Dòng " + line + ": " + (emp == null ? "không tìm thấy mã nhân viên " + r.employeeCode()
                            : shift == null ? "không tìm thấy ca " + r.shiftName() : "thiếu ngày"));
                }
                continue;
            }
            created += schedules.insertIfAbsent(emp, shift, r.date());
        }
        actor.audit(audit, "Import", "Import lịch làm việc: " + created + " ca");
        return Map.of("created", created, "errors", errors);
    }
}
