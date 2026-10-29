package com.vaxclinic.identity.hr.settings;

import com.vaxclinic.identity.hr.HrActor;
import com.vaxclinic.identity.hr.settings.HrSettings.AllHrSettings;
import com.vaxclinic.identity.hr.settings.HrSettings.BranchWorkdays;
import com.vaxclinic.identity.hr.settings.HrSettings.Holiday;
import com.vaxclinic.identity.hr.settings.HrSettings.Mobile;
import com.vaxclinic.identity.hr.settings.HrSettings.Payroll;
import com.vaxclinic.identity.hr.settings.HrSettings.Template;
import com.vaxclinic.identity.hr.settings.HrSettings.Timekeeping;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * Nhân viên → Thiết lập: chấm công, tính lương, ngày làm & nghỉ, chấm công điện thoại, mẫu lương; Khởi tạo (tiến độ).
 * Nghiệp vụ ở {@link HrSettingsManageService}.
 */
@RestController
@RequestMapping("/api/hr/settings")
@PreAuthorize("hasAuthority('hr.manage')")
public class HrSettingsController {

    /** Danh sách bọc trong {"items": [...]} để @Valid kiểm tra từng phần tử (lỗi trả 400 như các form khác). */
    public record Items<T>(@NotNull List<@Valid T> items) {
    }

    private final HrSettingsManageService service;

    public HrSettingsController(HrSettingsManageService service) {
        this.service = service;
    }

    @GetMapping
    public AllHrSettings all() {
        return service.all();
    }

    /** Tiến độ Khởi tạo (6 bước) — đếm dữ liệu thật. */
    @GetMapping("/overview")
    public Map<String, Object> overview() {
        return service.overview();
    }

    @PutMapping("/timekeeping")
    public AllHrSettings saveTimekeeping(@Valid @RequestBody Timekeeping req, @AuthenticationPrincipal Jwt jwt) {
        return service.saveTimekeeping(req, HrActor.of(jwt));
    }

    @PutMapping("/payroll")
    public AllHrSettings savePayroll(@Valid @RequestBody Payroll req, @AuthenticationPrincipal Jwt jwt) {
        return service.savePayroll(req, HrActor.of(jwt));
    }

    @PutMapping("/workdays")
    public AllHrSettings saveWorkdays(@Valid @RequestBody Items<BranchWorkdays> body, @AuthenticationPrincipal Jwt jwt) {
        return service.saveWorkdays(body.items(), HrActor.of(jwt));
    }

    @PutMapping("/holidays")
    public AllHrSettings saveHolidays(@Valid @RequestBody Items<Holiday> body, @AuthenticationPrincipal Jwt jwt) {
        return service.saveHolidays(body.items(), HrActor.of(jwt));
    }

    @PutMapping("/mobile")
    public AllHrSettings saveMobile(@RequestBody Mobile req, @AuthenticationPrincipal Jwt jwt) {
        return service.saveMobile(req, HrActor.of(jwt));
    }

    @PutMapping("/templates")
    public AllHrSettings saveTemplates(@Valid @RequestBody Items<Template> body, @AuthenticationPrincipal Jwt jwt) {
        return service.saveTemplates(body.items(), HrActor.of(jwt));
    }
}
