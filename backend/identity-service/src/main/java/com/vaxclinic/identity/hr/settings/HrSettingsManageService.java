package com.vaxclinic.identity.hr.settings;

import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.identity.hr.HrActor;
import com.vaxclinic.identity.hr.settings.HrSettings.AllHrSettings;
import com.vaxclinic.identity.hr.settings.HrSettings.BranchWorkdays;
import com.vaxclinic.identity.hr.settings.HrSettings.Holiday;
import com.vaxclinic.identity.hr.settings.HrSettings.Mobile;
import com.vaxclinic.identity.hr.settings.HrSettings.Payroll;
import com.vaxclinic.identity.hr.settings.HrSettings.Template;
import com.vaxclinic.identity.hr.settings.HrSettings.Timekeeping;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Màn Nhân viên → Thiết lập: kiểm tra + chuẩn hóa từng nhóm thiết lập, lưu qua {@link HrSettingsService}, ghi Lịch sử thao tác;
 * tiến độ Khởi tạo (6 bước) đếm từ {@link HrSetupProgressRepository}.
 */
@Service
public class HrSettingsManageService {

    private final HrSettingsService settings;
    private final HrSetupProgressRepository progress;
    private final AuditLogger audit;

    public HrSettingsManageService(HrSettingsService settings, HrSetupProgressRepository progress, AuditLogger audit) {
        this.settings = settings;
        this.progress = progress;
        this.audit = audit;
    }

    public AllHrSettings all() {
        return new AllHrSettings(settings.timekeeping(), settings.payroll(), settings.workdays(), settings.holidays(),
                settings.mobile(), settings.templates());
    }

    public Map<String, Object> overview() {
        return Map.of(
                "employees", progress.workingEmployees(),
                "shifts", progress.activeShifts(),
                "schedules", progress.schedules(),
                "timekeeping", progress.timekeepingSettings() + progress.deviceAttendance(),
                "salaries", progress.employeesWithSalary(),
                "payrolls", progress.activePayrolls());
    }

    public AllHrSettings saveTimekeeping(Timekeeping req, HrActor actor) {
        if (req.convertEnabled() && req.fullFrom() <= req.halfFrom()) {
            throw BusinessException.badRequest("INVALID_CONVERSION", "Mốc 1 công phải lớn hơn mốc nửa công");
        }
        return save(actor, "hr.timekeeping", req, "Thiết lập chấm công: giờ công chuẩn " + req.standardHours()
                + " giờ, đi muộn sau " + req.lateAfter() + " phút, về sớm trước " + req.earlyBefore() + " phút");
    }

    public AllHrSettings savePayroll(Payroll req, HrActor actor) {
        var clean = new Payroll(req.startDay(), req.hourMode(), req.autoCreate(), req.autoUpdate(),
                distinct(req.allowances()), distinct(req.deductions()), req.taxEnabled(), req.taxRate(), req.taxDeduction(),
                req.insuranceEnabled(), req.insuranceRate(), req.commissionBase());
        return save(actor, "hr.payroll", clean, "Thiết lập tính lương: kỳ lương từ ngày " + req.startDay()
                + ", thuế TNCN " + (req.taxEnabled() ? "Bật" : "Tắt") + ", BHXH " + (req.insuranceEnabled() ? "Bật" : "Tắt"));
    }

    public AllHrSettings saveWorkdays(List<BranchWorkdays> req, HrActor actor) {
        var clean = req.stream().map(w -> new BranchWorkdays(w.branchId(), new HashSet<>(w.days()).stream().sorted().toList())).toList();
        return save(actor, "hr.workdays", clean, "Thiết lập ngày làm việc của " + clean.size() + " chi nhánh");
    }

    public AllHrSettings saveHolidays(List<Holiday> items, HrActor actor) {
        var clean = new ArrayList<Holiday>();
        for (Holiday h : items) {
            if (h.to().isBefore(h.from())) {
                throw BusinessException.badRequest("INVALID_HOLIDAY", "Ngày kết thúc kỳ lễ tết phải sau ngày bắt đầu");
            }
            clean.add(new Holiday(h.id() == null ? UUID.randomUUID() : h.id(), h.name().trim(), h.from(), h.to(), h.multiplier()));
        }
        return save(actor, "hr.holidays", clean, "Thiết lập ngày lễ tết: " + clean.stream().map(Holiday::name).toList());
    }

    public AllHrSettings saveMobile(Mobile req, HrActor actor) {
        return save(actor, "hr.mobile", req, "Chấm công điện thoại: " + (req.enabled() ? "Bật" : "Tắt")
                + ", bắt buộc quét QR " + (req.requireQr() ? "Có" : "Không"));
    }

    public AllHrSettings saveTemplates(List<Template> items, HrActor actor) {
        var clean = items.stream().map(t -> new Template(t.id() == null ? UUID.randomUUID() : t.id(), t.name().trim(), t.salaryType(),
                t.salaryAmount(), t.overtimePercent(), t.commissionTableId(),
                t.allowances() == null ? List.of() : t.allowances(), t.deductions() == null ? List.of() : t.deductions())).toList();
        return save(actor, "hr.templates", clean, "Thiết lập mẫu lương: " + clean.stream().map(Template::name).toList());
    }

    private AllHrSettings save(HrActor actor, String key, Object value, String detail) {
        settings.write(key, value, actor.id());
        actor.audit(audit, "Sửa", detail);
        return all();
    }

    private static List<String> distinct(List<String> v) {
        return v == null ? List.of() : v.stream().map(String::trim).filter(s -> !s.isEmpty()).distinct().toList();
    }
}
