package com.vaxclinic.identity.hr.employee;

import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.common.search.AccentInsensitiveSql;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.common.web.PageResponse;
import com.vaxclinic.identity.hr.HrActor;
import com.vaxclinic.identity.hr.employee.EmployeeDtos.Employee;
import com.vaxclinic.identity.hr.employee.EmployeeDtos.EmployeeRequest;
import com.vaxclinic.identity.hr.employee.EmployeeDtos.EmployeeRow;
import com.vaxclinic.identity.hr.settings.HrSettings.PayItem;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.UUID;

/**
 * Lưu / tra cứu hồ sơ nhân viên ({@link EmployeeProfileRepository}). Mã NV tự sinh NV000001 khi để trống. Thêm / sửa / xóa từ màn hình ghi Lịch sử thao tác;
 * chỉ xóa được nhân viên chưa phát sinh dữ liệu ({@link EmployeeRepository}).
 */
@Service
public class EmployeeService {

    private final EmployeeProfileRepository profiles;
    private final EmployeeRepository employees;
    private final AuditLogger audit;

    public EmployeeService(EmployeeProfileRepository profiles, EmployeeRepository employees, AuditLogger audit) {
        this.profiles = profiles;
        this.employees = employees;
        this.audit = audit;
    }

    @Transactional
    public Employee create(EmployeeRequest req, HrActor actor) {
        Employee e = save(null, req);
        actor.audit(audit, HrActor.FEATURE, "Tạo", e.code(), "Tạo nhân viên " + e.code() + " - " + e.name());
        return e;
    }

    @Transactional
    public Employee update(UUID id, EmployeeRequest req, HrActor actor) {
        Employee e = save(id, req);
        actor.audit(audit, HrActor.FEATURE, "Sửa", e.code(), "Cập nhật nhân viên " + e.code() + " - " + e.name()
                + (e.salaryType() == null ? "" : ", lương " + e.salaryType() + " " + HrActor.money(e.salaryAmount())));
        return e;
    }

    /** Chỉ xóa được nhân viên chưa phát sinh chấm công / bảng lương; đã phát sinh → chuyển trạng thái "Đã nghỉ". */
    @Transactional
    public void delete(UUID id, HrActor actor) {
        Employee e = get(id);
        if (employees.usageCount(id) > 0) {
            throw BusinessException.badRequest("EMPLOYEE_IN_USE", "Nhân viên đã có dữ liệu chấm công / lương, hãy chuyển sang trạng thái Đã nghỉ");
        }
        employees.delete(id);
        actor.audit(audit, HrActor.FEATURE, "Xóa", e.code(), "Xóa nhân viên " + e.code() + " - " + e.name());
    }

    public PageResponse<EmployeeRow> search(String status, UUID departmentId, UUID jobTitleId, UUID branchId, String q,
                                            int page, int size) {
        var sql = new StringBuilder(" where 1=1");
        var args = new ArrayList<Object>();
        if (status != null && !status.isBlank()) {
            sql.append(" and e.status = ?");
            args.add(status);
        }
        if (departmentId != null) {
            sql.append(" and e.department_id = ?");
            args.add(departmentId);
        }
        if (jobTitleId != null) {
            sql.append(" and e.job_title_id = ?");
            args.add(jobTitleId);
        }
        if (branchId != null) {
            sql.append(" and (e.main_branch_id = ? or exists (select 1 from hr_employee_branches b where b.employee_id = e.id and b.branch_id = ?))");
            args.add(branchId);
            args.add(branchId);
        }
        if (q != null && !q.isBlank()) {
            sql.append(" and (e.code ilike ? or " + AccentInsensitiveSql.like("e.name", "?") + " or e.timekeeping_code ilike ? or e.phone ilike ?)");
            String like = "%" + q.trim().replace("%", "\\%").replace("_", "\\_") + "%";
            for (int i = 0; i < 4; i++) {
                args.add(like);
            }
        }
        Long total = profiles.count(sql.toString(), args);
        int limit = Math.min(Math.max(size, 1), 500);
        args.add(limit);
        args.add((long) Math.max(page, 0) * limit);
        var items = profiles.page(sql.toString(), args);
        return new PageResponse<>(items, total == null ? 0 : total, page, limit);
    }

    public Employee get(UUID id) {
        Employee e = profiles.find(id);
        if (e == null) {
            throw BusinessException.notFound("EMPLOYEE_NOT_FOUND", "Không tìm thấy nhân viên");
        }
        return e;
    }

    @Transactional
    public Employee save(UUID id, EmployeeRequest r) {
        boolean create = id == null;
        UUID empId = create ? UUID.randomUUID() : id;
        String code = HrActor.blankToNull(r.code());
        if (code == null) {
            code = create ? "NV%06d".formatted(profiles.nextCodeNumber()) : profiles.findCode(id);
        }
        var branchIds = new LinkedHashSet<UUID>(r.branchIds() == null ? List.of() : r.branchIds());
        UUID main = r.mainBranchId() != null ? r.mainBranchId() : branchIds.stream().findFirst().orElse(null);
        if (main != null) {
            branchIds.add(main);
        }
        Object[] values = {code.toUpperCase(), HrActor.blankToNull(r.timekeepingCode()), r.name().trim(), HrActor.blankToNull(r.phone()),
                HrActor.blankToNull(r.idNumber()), r.birthday(), r.gender(), r.startDate(), main, r.departmentId(), r.jobTitleId(),
                r.userId(), r.status() == null ? "WORKING" : r.status(), HrActor.blankToNull(r.note()), r.salaryType(),
                r.salaryAmount() == null ? BigDecimal.ZERO : r.salaryAmount(),
                r.overtimePercent() == null ? BigDecimal.valueOf(150) : r.overtimePercent(), r.commissionTableId(), r.endDate(), empId};
        if (r.startDate() != null && r.endDate() != null && r.endDate().isBefore(r.startDate())) {
            throw BusinessException.badRequest("INVALID_END_DATE", "Ngày nghỉ việc phải sau ngày bắt đầu làm việc");
        }
        try {
            if (create) {
                profiles.insert(values);
            } else if (profiles.update(values) == 0) {
                throw BusinessException.notFound("EMPLOYEE_NOT_FOUND", "Không tìm thấy nhân viên");
            }
        } catch (DuplicateKeyException e) {
            String m = String.valueOf(e.getMostSpecificCause().getMessage());
            throw BusinessException.conflict("EMPLOYEE_DUPLICATE", m.contains("timekeeping") ? "Mã chấm công đã được dùng cho nhân viên khác"
                    : m.contains("user_id") ? "Tài khoản đã được liên kết với nhân viên khác" : "Mã nhân viên đã tồn tại");
        }
        profiles.replaceBranches(empId, branchIds);
        profiles.deletePayItems(empId);
        insertItems(empId, "ALLOWANCE", r.allowances());
        insertItems(empId, "DEDUCTION", r.deductions());
        return get(empId);
    }

    private void insertItems(UUID empId, String type, List<PayItem> items) {
        if (items == null) {
            return;
        }
        for (PayItem it : items) {
            String kind = it.kind() == null ? "MONTH" : it.kind();
            if ("ALLOWANCE".equals(type) ? !kind.matches("DAY|MONTH") : !kind.matches("LATE|EARLY|MONTH")) {
                throw BusinessException.badRequest("INVALID_PAY_ITEM", "Loại " + ("ALLOWANCE".equals(type) ? "phụ cấp" : "giảm trừ") + " không hợp lệ");
            }
            profiles.insertPayItem(empId, type, it.name().trim(), kind, it.amount());
        }
    }

    public List<PayItem> payItems(UUID empId, String type) {
        return profiles.payItems(empId, type);
    }
}
