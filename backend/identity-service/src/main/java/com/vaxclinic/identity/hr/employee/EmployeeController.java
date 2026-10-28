package com.vaxclinic.identity.hr.employee;

import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.common.web.PageResponse;
import com.vaxclinic.identity.hr.HrActor;
import com.vaxclinic.identity.hr.HrCashflowOutbox;
import com.vaxclinic.identity.hr.employee.EmployeeDtos.AdvanceItem;
import com.vaxclinic.identity.hr.employee.EmployeeDtos.AdvanceRequest;
import com.vaxclinic.identity.hr.employee.EmployeeDtos.Employee;
import com.vaxclinic.identity.hr.employee.EmployeeDtos.EmployeeRequest;
import com.vaxclinic.identity.hr.employee.EmployeeDtos.EmployeeRow;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
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

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Danh sách nhân viên: tra cứu, thêm / sửa / xóa hồ sơ, Nợ và tạm ứng. */
@RestController
@RequestMapping("/api/hr/employees")
@PreAuthorize("hasAuthority('hr.manage')")
public class EmployeeController {

    private final EmployeeService service;
    private final JdbcTemplate jdbc;
    private final HrCashflowOutbox outbox;
    private final AuditLogger audit;

    public EmployeeController(EmployeeService service, JdbcTemplate jdbc, HrCashflowOutbox outbox, AuditLogger audit) {
        this.service = service;
        this.jdbc = jdbc;
        this.outbox = outbox;
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
    @Transactional
    public void delete(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        Employee e = service.get(id);
        Long used = jdbc.queryForObject("select (select count(*) from hr_attendance where employee_id = ?)"
                + " + (select count(*) from hr_payslips where employee_id = ?) + (select count(*) from hr_advances where employee_id = ?)",
                Long.class, id, id, id);
        if (used != null && used > 0) {
            throw BusinessException.badRequest("EMPLOYEE_IN_USE", "Nhân viên đã có dữ liệu chấm công / lương, hãy chuyển sang trạng thái Đã nghỉ");
        }
        jdbc.update("delete from hr_employees where id = ?", id);
        HrActor.of(jwt).audit(audit, HrActor.FEATURE, "Xóa", e.code(), "Xóa nhân viên " + e.code() + " - " + e.name());
    }

    @GetMapping("/{id}/advances")
    public List<AdvanceItem> advances(@PathVariable UUID id) {
        return jdbc.query("select id, kind, amount, occurred_at, note, cancelled from hr_advances where employee_id = ? order by occurred_at desc",
                (rs, i) -> new AdvanceItem(rs.getObject(1, UUID.class), rs.getString(2), rs.getBigDecimal(3),
                        rs.getTimestamp(4).toInstant(), rs.getString(5), rs.getBoolean(6)), id);
    }

    /** Tạm ứng lương: tăng "Nợ và tạm ứng", ghi phiếu chi vào Sổ quỹ; trừ dần khi thanh toán bảng lương. */
    @PostMapping("/{id}/advances")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public Employee advance(@PathVariable UUID id, @Valid @RequestBody AdvanceRequest req, @AuthenticationPrincipal Jwt jwt) {
        if (req.amount() == null) {
            throw BusinessException.badRequest("INVALID_AMOUNT", "Nhập số tiền tạm ứng");
        }
        Employee e = service.get(id);
        UUID branch = req.branchId() != null ? req.branchId() : e.mainBranchId();
        if (branch == null) {
            throw BusinessException.badRequest("BRANCH_REQUIRED", "Chọn chi nhánh chi tiền tạm ứng");
        }
        HrActor actor = HrActor.of(jwt);
        UUID advId = UUID.randomUUID();
        Instant now = Instant.now();
        jdbc.update("insert into hr_advances(id, employee_id, kind, amount, occurred_at, note, created_by) values (?,?,'ADVANCE',?,?,?,?)",
                advId, id, req.amount(), java.sql.Timestamp.from(now), HrActor.blankToNull(req.note()), actor.id());
        String code = "PCTU%06d".formatted(jdbc.queryForObject("select nextval('hr_payment_code_seq')", Long.class));
        outbox.paid(new HrCashflowOutbox.Payment("HR_ADVANCE", advId, code, req.fund() == null ? "CASH" : req.fund(),
                "Chi tạm ứng lương nhân viên", req.amount(), now, branch, id, e.name(), e.phone(), actor,
                "Tạm ứng lương " + e.code() + " - " + e.name() + (req.note() == null ? "" : ": " + req.note())));
        actor.audit(audit, HrActor.FEATURE, "Tạm ứng", e.code(), "Tạm ứng " + HrActor.money(req.amount()) + " cho " + e.name());
        return service.get(id);
    }
}
