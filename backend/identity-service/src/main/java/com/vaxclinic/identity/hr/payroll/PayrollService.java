package com.vaxclinic.identity.hr.payroll;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.identity.hr.HrActor;
import com.vaxclinic.identity.hr.attendance.AttendanceQuery;
import com.vaxclinic.identity.hr.commission.SellerRevenueClient;
import com.vaxclinic.identity.hr.commission.SellerRevenueClient.SellerRevenue;
import com.vaxclinic.identity.hr.employee.EmployeeService;
import com.vaxclinic.identity.hr.payroll.PayrollCalculator.Emp;
import com.vaxclinic.identity.hr.settings.HrSettingsService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Bảng lương: tạo theo kỳ, tính / tính lại phiếu lương (chỉ khi Tạm tính), chốt lương, hủy.
 * Trạng thái: DRAFT (Đang tạo) → TEMP (Tạm tính) → LOCKED (Đã chốt lương); CANCELLED (Đã hủy).
 */
@Service
public class PayrollService {

    private final JdbcTemplate jdbc;
    private final AttendanceQuery attendance;
    private final HrSettingsService settings;
    private final EmployeeService employees;
    private final SellerRevenueClient revenue;
    private final ObjectMapper json;

    public PayrollService(JdbcTemplate jdbc, AttendanceQuery attendance, HrSettingsService settings, EmployeeService employees,
                          SellerRevenueClient revenue, ObjectMapper json) {
        this.jdbc = jdbc;
        this.attendance = attendance;
        this.settings = settings;
        this.employees = employees;
        this.revenue = revenue;
        this.json = json;
    }

    @Transactional
    public UUID create(String name, LocalDate start, LocalDate end, UUID branchId, HrActor actor) {
        if (end.isBefore(start) || end.isAfter(start.plusDays(62))) {
            throw BusinessException.badRequest("INVALID_PERIOD", "Kỳ làm việc không hợp lệ (tối đa 2 tháng)");
        }
        UUID id = UUID.randomUUID();
        String code = "BL%06d".formatted(jdbc.queryForObject("select nextval('hr_payroll_code_seq')", Long.class));
        String title = name == null || name.isBlank() ? "Bảng lương tháng " + start.getMonthValue() + "/" + start.getYear() : name.trim();
        jdbc.update("""
                insert into hr_payrolls(id, code, name, period_start, period_end, branch_id, status, created_by, created_by_name)
                values (?,?,?,?,?,?,'DRAFT',?,?)""", id, code, title, start, end, branchId, actor == null ? null : actor.id(),
                actor == null ? "Hệ thống" : actor.name());
        recalculate(id);
        return id;
    }

    /** Tính lại toàn bộ phiếu lương (giữ thưởng nhập tay). Bảng đã chốt / đã hủy không tính lại. */
    @Transactional
    public void recalculate(UUID id) {
        var p = jdbc.queryForMap("select status, period_start, period_end, branch_id from hr_payrolls where id = ? for update", id);
        String status = (String) p.get("status");
        if (!"DRAFT".equals(status) && !"TEMP".equals(status)) {
            throw BusinessException.badRequest("PAYROLL_LOCKED", "Chỉ tính lại được bảng lương đang tạm tính");
        }
        LocalDate start = ((java.sql.Date) p.get("period_start")).toLocalDate();
        LocalDate end = ((java.sql.Date) p.get("period_end")).toLocalDate();
        UUID branch = (UUID) p.get("branch_id");
        var tk = settings.timekeeping();
        var pr = settings.payroll();
        var holidays = settings.holidays();
        var emps = jdbc.query("""
                select id, code, name, salary_type, salary_amount, overtime_percent, user_id, main_branch_id, commission_table_id,
                  start_date, end_date
                from hr_employees e where salary_type is not null
                  and (start_date is null or start_date <= ?) and (end_date is null or end_date >= ?)
                  and (status = 'WORKING' or end_date is not null or exists (select 1 from hr_attendance a where a.employee_id = e.id and a.approved and a.work_date between ? and ?))
                  and (?::uuid is null or main_branch_id = ? or exists (select 1 from hr_employee_branches b where b.employee_id = e.id and b.branch_id = ?))
                order by code""", (rs, i) -> new Object[]{new Emp(rs.getObject("id", UUID.class), rs.getString("code"), rs.getString("name"),
                rs.getString("salary_type"), rs.getBigDecimal("salary_amount"), rs.getBigDecimal("overtime_percent"), rs.getObject("user_id", UUID.class),
                List.of(), List.of()), rs.getObject("main_branch_id", UUID.class), rs.getObject("commission_table_id", UUID.class),
                rs.getObject("start_date", LocalDate.class), rs.getObject("end_date", LocalDate.class)},
                end, start, start, end, branch, branch, branch);
        boolean needRevenue = emps.stream().anyMatch(o -> o[2] != null && ((Emp) o[0]).userId() != null);
        List<SellerRevenue> sales = needRevenue ? revenue.revenue(start, end) : List.of();
        Map<UUID, Map<UUID, Object[]>> rulesByTable = new HashMap<>();
        jdbc.query("select table_id, product_id, rate_type, value from hr_commission_rules r join hr_commission_tables t on t.id = r.table_id where t.active",
                rs -> { rulesByTable.computeIfAbsent(rs.getObject(1, UUID.class), k -> new HashMap<>())
                        .put(rs.getObject(2, UUID.class), new Object[]{rs.getString(3), rs.getBigDecimal(4)}); });
        Map<UUID, BigDecimal> bonuses = new HashMap<>();
        jdbc.query("select employee_id, bonus from hr_payslips where payroll_id = ?", rs -> { bonuses.put(rs.getObject(1, UUID.class), rs.getBigDecimal(2)); }, id);
        var cells = attendance.cells(start, end, null, null, tk, pr.hourMode()).stream().filter(c -> c.approved()).toList();
        var kept = new java.util.ArrayList<UUID>();
        for (Object[] o : emps) {
            Emp base = (Emp) o[0];
            Emp e = new Emp(base.id(), base.code(), base.name(), base.salaryType(), base.amount(), base.overtimePercent(), base.userId(),
                    employees.payItems(base.id(), "ALLOWANCE"), employees.payItems(base.id(), "DEDUCTION"));
            UUID mainBranch = (UUID) o[1];
            List<Integer> workdays = mainBranch == null ? HrSettingsService.ALL_DAYS : settings.workdaysOf(mainBranch);
            int std = PayRates.standardDays(new PayRates.Period(start, end), workdays);
            int employed = PayRates.workingDays(maxDate(start, (LocalDate) o[3]), minDate(end, (LocalDate) o[4]), workdays);
            var rules = o[2] == null ? Map.<UUID, Object[]>of() : rulesByTable.getOrDefault((UUID) o[2], Map.of());
            var mine = e.userId() == null ? List.<SellerRevenue>of() : sales.stream().filter(s -> e.userId().equals(s.sellerId())).toList();
            var slip = PayrollCalculator.compute(new PayrollCalculator.Input(e, cells.stream().filter(c -> c.employeeId().equals(e.id())).toList(),
                    std, employed, tk, pr, mine, rules, d -> settings.holidayMultiplier(holidays, d), bonuses.get(e.id())));
            upsertSlip(id, e, slip);
            kept.add(e.id());
        }
        // nhân viên không còn thuộc bảng lương (đổi chi nhánh, bỏ thiết lập lương) và chưa được trả → bỏ phiếu
        jdbc.query("select employee_id from hr_payslips where payroll_id = ? and paid = 0", rs -> {
            UUID emp = rs.getObject(1, UUID.class);
            if (!kept.contains(emp)) {
                jdbc.update("delete from hr_payslips where payroll_id = ? and employee_id = ?", id, emp);
            }
        }, id);
        jdbc.update("""
                update hr_payrolls set status = 'TEMP', computed_at = now(),
                  total = (select coalesce(sum(total), 0) from hr_payslips where payroll_id = ?) where id = ?""", id, id);
    }

    private static LocalDate maxDate(LocalDate a, LocalDate b) {
        return b == null || a.isAfter(b) ? a : b;
    }

    private static LocalDate minDate(LocalDate a, LocalDate b) {
        return b == null || a.isBefore(b) ? a : b;
    }

    private void upsertSlip(UUID payrollId, Emp e, PayrollCalculator.Slip s) {
        String details;
        try {
            details = json.writeValueAsString(s.details());
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException(ex);
        }
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
                s.allowance(), s.commission(), s.bonus(), s.deduction(), s.insurance(), s.tax(), s.total(), details);
    }

    @Transactional
    public void setBonus(UUID payrollId, UUID slipId, BigDecimal bonus) {
        if (jdbc.update("update hr_payslips set bonus = ? where id = ? and payroll_id = ?", bonus, slipId, payrollId) == 0) {
            throw BusinessException.notFound("PAYSLIP_NOT_FOUND", "Không tìm thấy phiếu lương");
        }
        recalculate(payrollId);
    }

    @Transactional
    public void lock(UUID id) {
        if (jdbc.update("update hr_payrolls set status = 'LOCKED', locked_at = now() where id = ? and status = 'TEMP'", id) == 0) {
            throw BusinessException.badRequest("PAYROLL_NOT_TEMP", "Chỉ chốt được bảng lương đang tạm tính");
        }
    }

    @Transactional
    public void cancel(UUID id) {
        Long payments = jdbc.queryForObject("select count(*) from hr_payroll_payments where payroll_id = ? and not cancelled", Long.class, id);
        if (payments != null && payments > 0) {
            throw BusinessException.badRequest("PAYROLL_PAID", "Bảng lương đã có phiếu thanh toán, hãy hủy các phiếu thanh toán trước");
        }
        if (jdbc.update("update hr_payrolls set status = 'CANCELLED' where id = ? and status <> 'CANCELLED'", id) == 0) {
            throw BusinessException.notFound("PAYROLL_NOT_FOUND", "Không tìm thấy bảng lương");
        }
    }
}
