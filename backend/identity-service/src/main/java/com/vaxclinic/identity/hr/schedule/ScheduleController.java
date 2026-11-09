package com.vaxclinic.identity.hr.schedule;

import com.vaxclinic.identity.hr.HrActor;
import com.vaxclinic.identity.hr.schedule.ScheduleDtos.ImportRequest;
import com.vaxclinic.identity.hr.schedule.ScheduleDtos.ScheduleRequest;
import com.vaxclinic.identity.hr.schedule.ScheduleDtos.WeekView;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
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
import java.util.Map;
import java.util.UUID;

/** Lịch làm việc: xếp ca cho nhân viên theo ngày (lặp hàng tuần), lưới tuần + Lương dự kiến, import từ file. */
@RestController
@RequestMapping("/api/hr/schedules")
@PreAuthorize("hasAuthority('hr.manage')")
public class ScheduleController {

    private final ScheduleService service;

    public ScheduleController(ScheduleService service) {
        this.service = service;
    }

    @GetMapping
    public WeekView week(@RequestParam LocalDate from, @RequestParam LocalDate to) {
        return service.week(from, to);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Integer> create(@Valid @RequestBody ScheduleRequest req, @AuthenticationPrincipal Jwt jwt) {
        return service.create(req, HrActor.of(jwt));
    }

    /** repeat=true: xóa cả các ca cùng nhân viên, cùng ca, cùng thứ trong tuần từ ngày này trở đi. */
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id, @RequestParam(defaultValue = "false") boolean repeat, @AuthenticationPrincipal Jwt jwt) {
        service.delete(id, repeat, HrActor.of(jwt));
    }

    /** Import lịch: mỗi dòng Mã nhân viên + Ngày + Tên ca (file do màn Lịch làm việc đọc và gửi lên). */
    @PostMapping("/import")
    public Map<String, Object> importRows(@Valid @RequestBody ImportRequest req, @AuthenticationPrincipal Jwt jwt) {
        return service.importRows(req, HrActor.of(jwt));
    }
}
