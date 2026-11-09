package com.vaxclinic.identity.hr.settings;

import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.identity.hr.HrActor;
import com.vaxclinic.identity.hr.settings.HrSettings.BranchWorkdays;
import com.vaxclinic.identity.hr.settings.HrSettings.Holiday;
import com.vaxclinic.identity.hr.settings.HrSettings.Mobile;
import com.vaxclinic.identity.hr.settings.HrSettings.Payroll;
import com.vaxclinic.identity.hr.settings.HrSettings.Template;
import com.vaxclinic.identity.hr.settings.HrSettings.Timekeeping;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Nhân viên → Thiết lập: chấm công, tính lương, ngày làm & nghỉ, chấm công điện thoại, mẫu lương; Khởi tạo (tiến độ). */
@RestController
@RequestMapping("/api/hr/settings")
@PreAuthorize("hasAuthority('hr.manage')")
public class HrSettingsController {

    public record AllHrSettings(Timekeeping timekeeping, Payroll payroll, List<BranchWorkdays> workdays, List<Holiday> holidays,
                                Mobile mobile, List<Template> templates) {
    }

    /** Danh sách bọc trong {"items": [...]} để @Valid kiểm tra từng phần tử (lỗi trả 400 như các form khác). */
    public record Items<T>(@jakarta.validation.constraints.NotNull List<@Valid T> items) {
    }

    private final HrSettingsService settings;
    private final AuditLogger audit;

    public HrSettingsController(HrSettingsService settings, AuditLogger audit) {
        this.settings = settings;
        this.audit = audit;
    }

    @GetMapping
    public AllHrSettings all() {
        return new AllHrSettings(settings.timekeeping(), settings.payroll(), settings.workdays(), settings.holidays(),
                settings.mobile(), settings.templates());
    }

    /** Tiến độ Khởi tạo (6 bước) — đếm dữ liệu thật. */
    @GetMapping("/overview")
    public Map<String, Object> overview() {
        return settings.overview();
    }

    @PutMapping("/timekeeping")
    public AllHrSettings saveTimekeeping(@Valid @RequestBody Timekeeping req, @AuthenticationPrincipal Jwt jwt) {
        if (req.convertEnabled() && req.fullFrom() <= req.halfFrom()) {
            throw BusinessException.badRequest("INVALID_CONVERSION", "Mốc 1 công phải lớn hơn mốc nửa công");
        }
        return save(jwt, "hr.timekeeping", req, "Thiết lập chấm công: giờ công chuẩn " + req.standardHours()
                + " giờ, đi muộn sau " + req.lateAfter() + " phút, về sớm trước " + req.earlyBefore() + " phút");
    }

    @PutMapping("/payroll")
    public AllHrSettings savePayroll(@Valid @RequestBody Payroll req, @AuthenticationPrincipal Jwt jwt) {
        var clean = new Payroll(req.startDay(), req.hourMode(), req.autoCreate(), req.autoUpdate(),
                distinct(req.allowances()), distinct(req.deductions()), req.taxEnabled(), req.taxRate(), req.taxDeduction(),
                req.insuranceEnabled(), req.insuranceRate(), req.commissionBase());
        return save(jwt, "hr.payroll", clean, "Thiết lập tính lương: kỳ lương từ ngày " + req.startDay()
                + ", thuế TNCN " + (req.taxEnabled() ? "Bật" : "Tắt") + ", BHXH " + (req.insuranceEnabled() ? "Bật" : "Tắt"));
    }

    @PutMapping("/workdays")
    public AllHrSettings saveWorkdays(@Valid @RequestBody Items<BranchWorkdays> body, @AuthenticationPrincipal Jwt jwt) {
        var req = body.items();
        var clean = req.stream().map(w -> new BranchWorkdays(w.branchId(), new HashSet<>(w.days()).stream().sorted().toList())).toList();
        return save(jwt, "hr.workdays", clean, "Thiết lập ngày làm việc của " + clean.size() + " chi nhánh");
    }

    @PutMapping("/holidays")
    public AllHrSettings saveHolidays(@Valid @RequestBody Items<Holiday> body, @AuthenticationPrincipal Jwt jwt) {
        var clean = new ArrayList<Holiday>();
        for (Holiday h : body.items()) {
            if (h.to().isBefore(h.from())) {
                throw BusinessException.badRequest("INVALID_HOLIDAY", "Ngày kết thúc kỳ lễ tết phải sau ngày bắt đầu");
            }
            clean.add(new Holiday(h.id() == null ? UUID.randomUUID() : h.id(), h.name().trim(), h.from(), h.to(), h.multiplier()));
        }
        return save(jwt, "hr.holidays", clean, "Thiết lập ngày lễ tết: " + clean.stream().map(Holiday::name).toList());
    }

    @PutMapping("/mobile")
    public AllHrSettings saveMobile(@RequestBody Mobile req, @AuthenticationPrincipal Jwt jwt) {
        return save(jwt, "hr.mobile", req, "Chấm công điện thoại: " + (req.enabled() ? "Bật" : "Tắt")
                + ", bắt buộc quét QR " + (req.requireQr() ? "Có" : "Không"));
    }

    @PutMapping("/templates")
    public AllHrSettings saveTemplates(@Valid @RequestBody Items<Template> body, @AuthenticationPrincipal Jwt jwt) {
        var clean = body.items().stream().map(t -> new Template(t.id() == null ? UUID.randomUUID() : t.id(), t.name().trim(), t.salaryType(),
                t.salaryAmount(), t.overtimePercent(), t.commissionTableId(),
                t.allowances() == null ? List.of() : t.allowances(), t.deductions() == null ? List.of() : t.deductions())).toList();
        return save(jwt, "hr.templates", clean, "Thiết lập mẫu lương: " + clean.stream().map(Template::name).toList());
    }

    private AllHrSettings save(Jwt jwt, String key, Object value, String detail) {
        HrActor actor = HrActor.of(jwt);
        settings.write(key, value, actor.id());
        actor.audit(audit, "Sửa", detail);
        return all();
    }

    private static List<String> distinct(List<String> v) {
        return v == null ? List.of() : v.stream().map(String::trim).filter(s -> !s.isEmpty()).distinct().toList();
    }
}
