package com.vaxclinic.identity.hr.employee;

import com.vaxclinic.identity.hr.employee.EmployeeDtos.BranchRef;
import com.vaxclinic.identity.hr.employee.EmployeeDtos.Employee;
import com.vaxclinic.identity.hr.employee.EmployeeDtos.EmployeeRow;
import com.vaxclinic.identity.hr.settings.HrSettings.PayItem;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Hồ sơ nhân viên (hr_employees + chi nhánh làm việc + phụ cấp / giảm trừ): danh sách, chi tiết, thêm / sửa.
 * Xóa / tạm ứng nằm ở {@link EmployeeRepository}. Chỉ truy cập DB.
 */
@Repository
public class EmployeeProfileRepository {

    /** Số dư "Nợ và tạm ứng": tạm ứng − đã khấu trừ khi trả lương. */
    static final String DEBT_SQL = "(select coalesce(sum(case a.kind when 'ADVANCE' then a.amount else -a.amount end), 0)"
            + " from hr_advances a where a.employee_id = e.id and not a.cancelled)";

    private static final String ROW_SQL = "select e.*, d.name department_name, j.name job_title_name, " + DEBT_SQL + " debt"
            + " from hr_employees e left join hr_departments d on d.id = e.department_id"
            + " left join hr_job_titles j on j.id = e.job_title_id";

    private final JdbcTemplate jdbc;

    public EmployeeProfileRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** {@code where} bắt đầu bằng " where", tham chiếu bảng hr_employees qua alias {@code e}. */
    public Long count(String where, List<Object> args) {
        return jdbc.queryForObject("select count(*) from hr_employees e" + where, Long.class, args.toArray());
    }

    /** {@code args} gồm tham số của {@code where} rồi limit, offset. */
    public List<EmployeeRow> page(String where, List<Object> args) {
        return jdbc.query(ROW_SQL + where + " order by e.code desc limit ? offset ?", (rs, i) -> row(rs), args.toArray());
    }

    /** null = không có nhân viên. */
    public Employee find(UUID id) {
        return jdbc.query("""
                select e.*, d.name department_name, j.name job_title_name, u.username, t.name commission_table_name,
                """ + DEBT_SQL + """
                 debt from hr_employees e left join hr_departments d on d.id = e.department_id
                left join hr_job_titles j on j.id = e.job_title_id left join users u on u.id = e.user_id
                left join hr_commission_tables t on t.id = e.commission_table_id where e.id = ?""", rs -> {
            if (!rs.next()) {
                return null;
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

    public Long nextCodeNumber() {
        return jdbc.queryForObject("select nextval('hr_employee_code_seq')", Long.class);
    }

    public String findCode(UUID id) {
        return jdbc.queryForObject("select code from hr_employees where id = ?", String.class, id);
    }

    /** {@code values} theo thứ tự cột của câu insert, id cuối cùng. */
    public void insert(Object[] values) {
        jdbc.update("""
                insert into hr_employees(code, timekeeping_code, name, phone, id_number, birthday, gender, start_date,
                  main_branch_id, department_id, job_title_id, user_id, status, note, salary_type, salary_amount,
                  overtime_percent, commission_table_id, end_date, id) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""", values);
    }

    /** Cùng thứ tự {@code values} như {@link #insert}; số dòng đã sửa. */
    public int update(Object[] values) {
        return jdbc.update("""
                update hr_employees set code=?, timekeeping_code=?, name=?, phone=?, id_number=?, birthday=?, gender=?, start_date=?,
                  main_branch_id=?, department_id=?, job_title_id=?, user_id=?, status=?, note=?, salary_type=?, salary_amount=?,
                  overtime_percent=?, commission_table_id=?, end_date=? where id=?""", values);
    }

    /** Ghi lại toàn bộ chi nhánh làm việc của nhân viên. */
    public void replaceBranches(UUID empId, Iterable<UUID> branchIds) {
        jdbc.update("delete from hr_employee_branches where employee_id = ?", empId);
        branchIds.forEach(b -> jdbc.update("insert into hr_employee_branches(employee_id, branch_id) values (?, ?)", empId, b));
    }

    public void deletePayItems(UUID empId) {
        jdbc.update("delete from hr_employee_pay_items where employee_id = ?", empId);
    }

    public void insertPayItem(UUID empId, String type, String name, String kind, BigDecimal amount) {
        jdbc.update("insert into hr_employee_pay_items(id, employee_id, item_type, name, kind, amount) values (?,?,?,?,?,?)",
                UUID.randomUUID(), empId, type, name, kind, amount);
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
