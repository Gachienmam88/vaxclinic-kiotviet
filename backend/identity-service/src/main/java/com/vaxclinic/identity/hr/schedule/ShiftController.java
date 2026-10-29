package com.vaxclinic.identity.hr.schedule;

import com.vaxclinic.identity.hr.HrActor;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

/** Ca làm việc (Thiết lập chấm công → Thiết lập ca làm việc, nút "+" ở Bảng chấm công). Nghiệp vụ ở {@link ShiftService}. */
@RestController
@RequestMapping("/api/hr/shifts")
@PreAuthorize("hasAuthority('hr.manage')")
public class ShiftController {

    public record ShiftRequest(@NotBlank @Size(max = 100) String name, @NotNull LocalTime startTime, @NotNull LocalTime endTime,
                               Boolean active) {
    }

    private final ShiftService service;

    public ShiftController(ShiftService service) {
        this.service = service;
    }

    @GetMapping
    public List<Shift> list() {
        return service.list();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Shift create(@Valid @RequestBody ShiftRequest req, @AuthenticationPrincipal Jwt jwt) {
        return service.create(req, HrActor.of(jwt));
    }

    @PutMapping("/{id}")
    public Shift update(@PathVariable UUID id, @Valid @RequestBody ShiftRequest req, @AuthenticationPrincipal Jwt jwt) {
        return service.update(id, req, HrActor.of(jwt));
    }

    /** Ca đã dùng (lịch / chấm công) chỉ ngừng hoạt động, không xóa hẳn. */
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        service.delete(id, HrActor.of(jwt));
    }
}
