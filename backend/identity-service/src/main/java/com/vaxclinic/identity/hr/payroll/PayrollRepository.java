package com.vaxclinic.identity.hr.payroll;

import com.vaxclinic.identity.hr.payroll.PayrollCalculator.Emp;
import com.vaxclinic.identity.hr.payroll.PayrollCalculator.Slip;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Ghi bảng lương (hr_payrolls) và phiếu lương (hr_payslips) khi tạo / tính lại / chốt / hủy. Tra cứu nằm ở {@link PayrollQueryRepository}. Chỉ truy cập DB. */
@Repository
public class PayrollRepository {

    /** Nhân viên thuộc bảng lương (chưa có phụ cấp / giảm trừ) kèm chi nhánh chính, bảng hoa hồng, ngày làm / nghỉ việc. */
    public record PayrollEmployee(Emp emp, UUID mainBranchId, UUID commissionTableId, LocalDate startDate, LocalDate endDate) {
    }

    private final JdbcTemplate jdbc;

    public PayrollRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Long nextCodeNumber() {
        return jdbc.queryForObject("select nextval('hr_payroll_code_seq')", Long.class);
    }

    public void insert(UUID id, String code, String name, LocalDate start, LocalDate end, UUID branchId, UUID createdBy, String createdByName) {
        jdbc.update("""
                insert into hr_payrolls(id, code, name, period_start, period_end, branch_id, status, created_by, created_by_name)
                values (?,?,?,?,?,?,'DRAFT',?,?)""", id, code, name, start, end, branchId, createdBy, createdByName);
    }

    /** Khóa dòng bảng lương (status, period_start, period_end, branch_id). */
    public Map<String, Object> lockHeader(UUID id) {
        return jdbc.queryForMap("select status, period_start, period_end, branch_id from hr_payrolls where id = ? for update", id);
    }

    /** Nhân viên có thiết lập lương, còn làm trong kỳ (hoặc có công đã duyệt), thuộc chi nhánh nếu có; theo mã. */
    public List<PayrollEmployee> employees(LocalDate start, LocalDate end, UUID branch) {
        return jdbc.query("""
                select id, code, name, salary_type, salary_amount, overtime_percent, user_id, main_branch_id, commission_table_id,
                  start_date, end_date
                from hr_employees e where salary_type is not null
                  and (start_date is null or start_date <= ?) and (end_date is null or end_date >= ?)
                  and (status = 'WORKING' or end_date is not null or exists (select 1 from hr_attendance a where a.employee_id = e.id and a.approved and a.work_date between ? and ?))
                  and (?::uuid is null or main_branch_id = ? or exists (select 1 from hr_employee_branches b where b.employee_id = e.id and b.branch_id = ?))
                order by code""", (rs, i) -> new PayrollEmployee(new Emp(rs.getObject("id", UUID.class), rs.getString("code"), rs.getString("name"),
                rs.getString("salary_type"), rs.getBigDecimal("salary_amount"), rs.getBigDecimal("overtime_percent"), rs.getObject("user_id", UUID.class),
                List.of(), List.of()), rs.getObject("main_branch_id", UUID.class), rs.getObject("commission_table_id", UUID.class),
                rs.getObject("start_date", LocalDate.class), rs.getObject("end_date", LocalDate.class)),
                end, start, start, end, branch, branch, branch);
    }

    /** Luật hoa hồng của các bảng đang dùng: bảng → sản phẩm → {rate_type, value}. */
    public Map<UUID, Map<UUID, Object[]>> activeCommissionRules() {
        Map<UUID, Map<UUID, Object[]>> rulesByTable = new HashMap<>();
        jdbc.query("select table_id, product_id, rate_type, value from hr_commission_rules r join hr_commission_tables t on t.id = r.table_id where t.active",
                rs -> { rulesByTable.computeIfAbsent(rs.getObject(1, UUID.class), k -> new HashMap<>())
                        .put(rs.getObject(2, UUID.class), new Object[]{rs.getString(3), rs.getBigDecimal(4)}); });
        return rulesByTable;
    }

    /** Thưởng nhập tay theo nhân viên. */
    public Map<UUID, BigDecimal> bonuses(UUID payrollId) {
        Map<UUID, BigDecimal> bonuses = new HashMap<>();
        jdbc.query("select employee_id, bonus from hr_payslips where payroll_id = ?", rs -> { bonuses.put(rs.getObject(1, UUID.class), rs.getBigDecimal(2)); }, payrollId);
        return bonuses;
    }

    public void upsertSlip(UUID payrollId, Emp e, Slip s, String detailsJson) {
        jdbc.update("""
                insert into hr_payslips(id, payroll_id, employee_id, employee_code, employee_name, salary_type, work_units, base_amount,
                  overtime_amount, holiday_amount, allowance, commission, bonus, deduction, insurance, tax, total, details)
                values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?::jsonb)
                on conflict (payroll_id, employee_id) do update set employee_code = excluded.employee_code, employee_name = excluded.employee_name,
                  salary_type = excluded.salary_type, work_units = excluded.work_units, base_amount = excluded.base_amount,
                  overtime_amount = excluded.overtime_amount, holiday_amount = excluded.holiday_amount, allowance = excluded.allowance,
                  commission = excluded.commission, bonus = excluded.bonus, deduction = excluded.deduction, insurance = excluded.insurance,
                  tax = excluded.tax, total = excluded.total, details = excluded.details""",
                UUID.randomUUID(), payrollId, e.id(), e.code(), e.name(), e.salaryType(), s.workUnits(), s.base(), s.overtime(), s.holiday(),
                s.allowance(), s.commission(), s.bonus(), s.deduction(), s.insurance(), s.tax(), s.total(), detailsJson);
    }

    /** Nhân viên có phiếu lương chưa trả đồng nào. */
    public List<UUID> unpaidSlipEmployees(UUID payrollId) {
        return jdbc.query("select employee_id from hr_payslips where payroll_id = ? and paid = 0", (rs, i) -> rs.getObject(1, UUID.class), payrollId);
    }

    public void deleteSlip(UUID payrollId, UUID employeeId) {
        jdbc.update("delete from hr_payslips where payroll_id = ? and employee_id = ?", payrollId, employeeId);
    }

    /** Chuyển sang Tạm tính, cập nhật tổng lương. */
    public void markComputed(UUID id) {
        jdbc.update("""
                update hr_payrolls set status = 'TEMP', computed_at = now(),
                  total = (select coalesce(sum(total), 0) from hr_payslips where payroll_id = ?) where id = ?""", id, id);
    }

    /** Số dòng đã sửa. */
    public int setBonus(UUID payrollId, UUID slipId, BigDecimal bonus) {
        return jdbc.update("update hr_payslips set bonus = ? where id = ? and payroll_id = ?", bonus, slipId, payrollId);
    }

    /** Số dòng đã sửa (0 = không ở trạng thái Tạm tính). */
    public int lock(UUID id) {
        return jdbc.update("update hr_payrolls set status = 'LOCKED', locked_at = now() where id = ? and status = 'TEMP'", id);
    }

    public Long countActivePayments(UUID id) {
        return jdbc.queryForObject("select count(*) from hr_payroll_payments where payroll_id = ? and not cancelled", Long.class, id);
    }

    /** Số dòng đã sửa (0 = không có / đã hủy). */
    public int cancel(UUID id) {
        return jdbc.update("update hr_payrolls set status = 'CANCELLED' where id = ? and status <> 'CANCELLED'", id);
    }
}
