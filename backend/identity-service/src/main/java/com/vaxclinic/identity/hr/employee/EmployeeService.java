package com.vaxclinic.identity.hr.employee;

import com.vaxclinic.common.search.AccentInsensitiveSql;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.common.web.PageResponse;
import com.vaxclinic.identity.hr.HrActor;
import com.vaxclinic.identity.hr.employee.EmployeeDtos.BranchRef;
import com.vaxclinic.identity.hr.employee.EmployeeDtos.Employee;
import com.vaxclinic.identity.hr.employee.EmployeeDtos.EmployeeRequest;
import com.vaxclinic.identity.hr.employee.EmployeeDtos.EmployeeRow;
import com.vaxclinic.identity.hr.settings.HrSettings.PayItem;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.UUID;

/** Lưu / tra cứu hồ sơ nhân viên (JDBC). Mã NV tự sinh NV000001 khi để trống. */
@Service
public class EmployeeService {

    /** Số dư "Nợ và tạm ứng": tạm ứng − đã khấu trừ khi trả lương. */
    static final String DEBT_SQL = "(select coalesce(sum(case a.kind when 'ADVANCE' then a.amount else -a.amount end), 0)"
            + " from hr_advances a where a.employee_id = e.id and not a.cancelled)";

    private static final String ROW_SQL = "select e.*, d.name department_name, j.name job_title_name, " + DEBT_SQL + " debt"
            + " from hr_employees e left join hr_departments d on d.id = e.department_id"
            + " left join hr_job_titles j on j.id = e.job_title_id";

    private final JdbcTemplate jdbc;

    public EmployeeService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
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
        Long total = jdbc.queryForObject("select count(*) from hr_employees e" + sql, Long.class, args.toArray());
        int limit = Math.min(Math.max(size, 1), 500);
        args.add(limit);
        args.add((long) Math.max(page, 0) * limit);
        var items = jdbc.query(ROW_SQL + sql + " order by e.code desc limit ? offset ?", (rs, i) -> row(rs), args.toArray());
        return new PageResponse<>(items, total == null ? 0 : total, page, limit);
    }

    public Employee get(UUID id) {
        return jdbc.query("""
                select e.*, d.name department_name, j.name job_title_name, u.username, t.name commission_table_name,
                """ + DEBT_SQL + """
                 debt from hr_employees e left join hr_departments d on d.id = e.department_id
                left join hr_job_titles j on j.id = e.job_title_id left join users u on u.id = e.user_id
                left join hr_commission_tables t on t.id = e.commission_table_id where e.id = ?""", rs -> {
            if (!rs.next()) {
                throw BusinessException.notFound("EMPLOYEE_NOT_FOUND", "Không tìm thấy nhân viên");
            }
            return new Employee(id, rs.getString("code"), rs.getString("timekeeping_code"), rs.getString("name"),
                    rs.getString("phone"), rs.getString("id_number"), rs.getObject("birthday", LocalDate.class), rs.getString("gender"),
                    rs.getObject("start_date", LocalDate.class), rs.getObject("end_date", LocalDate.class),
                    rs.getObject("main_branch_id", UUID.class), branches(id),
                    rs.getObject("department_id", UUID.class), rs.getString("department_name"),
                    rs.getObject("job_title_id", UUID.class), rs.getString("job_title_name"),
                    rs.getObject("user_id", UUID.class), rs.getString("username"), rs.getString("status"), rs.getString("note"),
                    rs.getString("salary_type"), rs.getBigDecimal("salary_amount"), rs.getBigDecimal("overtime_percent"),
                    rs.getObject("commission_table_id", UUID.class), rs.getString("commission_table_name"),
                    payItems(id, "ALLOWANCE"), payItems(id, "DEDUCTION"), rs.getBigDecimal("debt"));
        }, id);
    }

    @Transactional
    public Employee save(UUID id, EmployeeRequest r) {
        boolean create = id == null;
        UUID empId = create ? UUID.randomUUID() : id;
        String code = HrActor.blankToNull(r.code());
        if (code == null) {
            code = create ? "NV%06d".formatted(jdbc.queryForObject("select nextval('hr_employee_code_seq')", Long.class))
                    : jdbc.queryForObject("select code from hr_employees where id = ?", String.class, id);
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
                jdbc.update("""
                        insert into hr_employees(code, timekeeping_code, name, phone, id_number, birthday, gender, start_date,
                          main_branch_id, department_id, job_title_id, user_id, status, note, salary_type, salary_amount,
                          overtime_percent, commission_table_id, end_date, id) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""", values);
            } else if (jdbc.update("""
                    update hr_employees set code=?, timekeeping_code=?, name=?, phone=?, id_number=?, birthday=?, gender=?, start_date=?,
                      main_branch_id=?, department_id=?, job_title_id=?, user_id=?, status=?, note=?, salary_type=?, salary_amount=?,
                      overtime_percent=?, commission_table_id=?, end_date=? where id=?""", values) == 0) {
                throw BusinessException.notFound("EMPLOYEE_NOT_FOUND", "Không tìm thấy nhân viên");
            }
        } catch (DuplicateKeyException e) {
            String m = String.valueOf(e.getMostSpecificCause().getMessage());
            throw BusinessException.conflict("EMPLOYEE_DUPLICATE", m.contains("timekeeping") ? "Mã chấm công đã được dùng cho nhân viên khác"
                    : m.contains("user_id") ? "Tài khoản đã được liên kết với nhân viên khác" : "Mã nhân viên đã tồn tại");
        }
        jdbc.update("delete from hr_employee_branches where employee_id = ?", empId);
        branchIds.forEach(b -> jdbc.update("insert into hr_employee_branches(employee_id, branch_id) values (?, ?)", empId, b));
        jdbc.update("delete from hr_employee_pay_items where employee_id = ?", empId);
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
            jdbc.update("insert into hr_employee_pay_items(id, employee_id, item_type, name, kind, amount) values (?,?,?,?,?,?)",
                    UUID.randomUUID(), empId, type, it.name().trim(), kind, it.amount());
        }
    }

    public List<PayItem> payItems(UUID empId, String type) {
        return jdbc.query("select name, kind, amount from hr_employee_pay_items where employee_id = ? and item_type = ? order by name",
                (rs, i) -> new PayItem(rs.getString(1), rs.getString(2), rs.getBigDecimal(3)), empId, type);
    }

    private List<BranchRef> branches(UUID empId) {
        return jdbc.query("select b.id, b.name from hr_employee_branches eb join branches b on b.id = eb.branch_id where eb.employee_id = ? order by b.code",
                (rs, i) -> new BranchRef(rs.getObject(1, UUID.class), rs.getString(2)), empId);
    }

    static EmployeeRow row(ResultSet rs) throws SQLException {
        return new EmployeeRow(rs.getObject("id", UUID.class), rs.getString("code"), rs.getString("timekeeping_code"),
                rs.getString("name"), rs.getString("phone"), rs.getString("id_number"), rs.getBigDecimal("debt"), rs.getString("note"),
                rs.getString("status"), rs.getString("salary_type"), rs.getBigDecimal("salary_amount"),
                rs.getObject("department_id", UUID.class), rs.getString("department_name"),
                rs.getObject("job_title_id", UUID.class), rs.getString("job_title_name"),
                rs.getObject("main_branch_id", UUID.class), rs.getObject("user_id", UUID.class));
    }
}
