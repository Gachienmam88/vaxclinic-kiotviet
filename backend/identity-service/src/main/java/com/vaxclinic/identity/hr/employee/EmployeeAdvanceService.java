package com.vaxclinic.identity.hr.employee;

import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.identity.hr.HrActor;
import com.vaxclinic.identity.hr.HrCashflowOutbox;
import com.vaxclinic.identity.hr.employee.EmployeeDtos.AdvanceItem;
import com.vaxclinic.identity.hr.employee.EmployeeDtos.AdvanceRequest;
import com.vaxclinic.identity.hr.employee.EmployeeDtos.Employee;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Nợ và tạm ứng: tạm ứng lương tăng nợ, ghi phiếu chi PCTU vào Sổ quỹ (qua outbox); trừ dần khi thanh toán bảng lương. */
@Service
public class EmployeeAdvanceService {

    private final EmployeeService employees;
    private final EmployeeRepository repo;
    private final HrCashflowOutbox outbox;
    private final AuditLogger audit;

    public EmployeeAdvanceService(EmployeeService employees, EmployeeRepository repo, HrCashflowOutbox outbox, AuditLogger audit) {
        this.employees = employees;
        this.repo = repo;
        this.outbox = outbox;
        this.audit = audit;
    }

    public List<AdvanceItem> advances(UUID employeeId) {
        return repo.advances(employeeId);
    }

    @Transactional
    public Employee advance(UUID id, AdvanceRequest req, HrActor actor) {
        if (req.amount() == null) {
            throw BusinessException.badRequest("INVALID_AMOUNT", "Nhập số tiền tạm ứng");
        }
        Employee e = employees.get(id);
        UUID branch = req.branchId() != null ? req.branchId() : e.mainBranchId();
        if (branch == null) {
            throw BusinessException.badRequest("BRANCH_REQUIRED", "Chọn chi nhánh chi tiền tạm ứng");
        }
        UUID advId = UUID.randomUUID();
        Instant now = Instant.now();
        repo.insertAdvance(advId, id, req.amount(), now, HrActor.blankToNull(req.note()), actor.id());
        String code = "PCTU%06d".formatted(repo.nextPaymentCodeNumber());
        outbox.paid(new HrCashflowOutbox.Payment("HR_ADVANCE", advId, code, req.fund() == null ? "CASH" : req.fund(),
                "Chi tạm ứng lương nhân viên", req.amount(), now, branch, id, e.name(), e.phone(), actor,
                "Tạm ứng lương " + e.code() + " - " + e.name() + (req.note() == null ? "" : ": " + req.note())));
        actor.audit(audit, HrActor.FEATURE, "Tạm ứng", e.code(), "Tạm ứng " + HrActor.money(req.amount()) + " cho " + e.name());
        return employees.get(id);
    }
}
