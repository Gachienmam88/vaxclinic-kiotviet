package com.vaxclinic.identity.hr.attendance.controller;

import com.vaxclinic.identity.hr.attendance.service.AttendanceService;
import com.vaxclinic.identity.hr.dto.HrActor;
import com.vaxclinic.identity.hr.attendance.dto.AttendanceDtos.ApproveRequest;
import com.vaxclinic.identity.hr.attendance.dto.AttendanceDtos.ApproveResult;
import com.vaxclinic.identity.hr.attendance.dto.AttendanceDtos.ManualRequest;
import com.vaxclinic.identity.hr.attendance.service.AttendanceQuery.Cell;
import jakarta.validation.Valid;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Bảng chấm công: lưới theo ca / nhân viên, sửa tay giờ vào-ra / nghỉ, Duyệt chấm công. */
@RestController
@RequestMapping("/api/hr/attendance")
@PreAuthorize("hasAuthority('hr.manage')")
public class AttendanceController {

    private final AttendanceService service;

    public AttendanceController(AttendanceService service) {
        this.service = service;
    }

    @GetMapping
    public List<Cell> cells(@RequestParam LocalDate from, @RequestParam LocalDate to,
                            @RequestParam(required = false) UUID branchId, @RequestParam(required = false) UUID employeeId) {
        return service.cells(from, to, branchId, employeeId);
    }

    @PutMapping
    public Cell save(@Valid @RequestBody ManualRequest req, @AuthenticationPrincipal Jwt jwt) {
        return service.save(req, HrActor.of(jwt));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        service.delete(id, HrActor.of(jwt));
    }

    /** Duyệt các ô đã chấm đủ vào-ra hoặc nghỉ trong khoảng ngày (hoặc theo danh sách id). Chỉ ô đã duyệt được tính lương. */
    @PostMapping("/approve")
    public ApproveResult approve(@Valid @RequestBody ApproveRequest req, @AuthenticationPrincipal Jwt jwt) {
        return service.approve(req, HrActor.of(jwt));
    }
}
