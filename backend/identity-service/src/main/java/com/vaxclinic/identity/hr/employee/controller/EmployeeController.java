package com.vaxclinic.identity.hr.employee.controller;

import com.vaxclinic.identity.hr.employee.service.EmployeeService;
import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.common.web.PageResponse;
import com.vaxclinic.identity.hr.dto.HrActor;
import com.vaxclinic.identity.hr.employee.dto.EmployeeDtos.AdvanceItem;
import com.vaxclinic.identity.hr.employee.dto.EmployeeDtos.AdvanceRequest;
import com.vaxclinic.identity.hr.employee.dto.EmployeeDtos.Employee;
import com.vaxclinic.identity.hr.employee.dto.EmployeeDtos.EmployeeRequest;
import com.vaxclinic.identity.hr.employee.dto.EmployeeDtos.EmployeeRow;
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

import java.util.List;
import java.util.UUID;

/** Danh sách nhân viên: tra cứu, thêm / sửa / xóa hồ sơ, Nợ và tạm ứng. */
@RestController
@RequestMapping("/api/hr/employees")
@PreAuthorize("hasAuthority('hr.manage')")
public class EmployeeController {

    private final EmployeeService service;
    private final AuditLogger audit;

    public EmployeeController(EmployeeService service, AuditLogger audit) {
        this.service = service;
        this.audit = audit;
    }

    @GetMapping
    public PageResponse<EmployeeRow> search(@RequestParam(required = false) String status,
                                            @RequestParam(required = false) UUID departmentId,
                                            @RequestParam(required = false) UUID jobTitleId,
                                            @RequestParam(required = false) UUID branchId,
                                            @RequestParam(defaultValue = "") String q,
                                            @RequestParam(defaultValue = "0") int page,
                                            @RequestParam(defaultValue = "20") int size) {
        return service.search(status, departmentId, jobTitleId, branchId, q, page, size);
    }

    @GetMapping("/{id}")
    public Employee get(@PathVariable UUID id) {
        return service.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Employee create(@Valid @RequestBody EmployeeRequest req, @AuthenticationPrincipal Jwt jwt) {
        Employee e = service.save(null, req);
        HrActor.of(jwt).audit(audit, HrActor.FEATURE, "Tạo", e.code(), "Tạo nhân viên " + e.code() + " - " + e.name());
        return e;
    }

    @PutMapping("/{id}")
    public Employee update(@PathVariable UUID id, @Valid @RequestBody EmployeeRequest req, @AuthenticationPrincipal Jwt jwt) {
        Employee e = service.save(id, req);
        HrActor.of(jwt).audit(audit, HrActor.FEATURE, "Sửa", e.code(), "Cập nhật nhân viên " + e.code() + " - " + e.name()
                + (e.salaryType() == null ? "" : ", lương " + e.salaryType() + " " + HrActor.money(e.salaryAmount())));
        return e;
    }

    /** Chỉ xóa được nhân viên chưa phát sinh chấm công / bảng lương; đã phát sinh → chuyển trạng thái "Đã nghỉ". */
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        service.delete(id, HrActor.of(jwt));
    }

    @GetMapping("/{id}/advances")
    public List<AdvanceItem> advances(@PathVariable UUID id) {
        return service.advances(id);
    }

    /** Tạm ứng lương: tăng "Nợ và tạm ứng", ghi phiếu chi vào Sổ quỹ; trừ dần khi thanh toán bảng lương. */
    @PostMapping("/{id}/advances")
    @ResponseStatus(HttpStatus.CREATED)
    public Employee advance(@PathVariable UUID id, @Valid @RequestBody AdvanceRequest req, @AuthenticationPrincipal Jwt jwt) {
        return service.advance(id, req, HrActor.of(jwt));
    }
}
