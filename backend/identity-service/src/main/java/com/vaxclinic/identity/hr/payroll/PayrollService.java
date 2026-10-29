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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Bảng lương: tạo theo kỳ, tính / tính lại phiếu lương (chỉ khi Tạm tính), chốt lương, hủy.
 * Trạng thái: DRAFT (Đang tạo) → TEMP (Tạm tính) → LOCKED (Đã chốt lương); CANCELLED (Đã hủy).
 */
@Service
public class PayrollService {

    private final PayrollRepository repo;
    private final AttendanceQuery attendance;
    private final HrSettingsService settings;
    private final EmployeeService employees;
    private final SellerRevenueClient revenue;
    private final ObjectMapper json;

    public PayrollService(PayrollRepository repo, AttendanceQuery attendance, HrSettingsService settings, EmployeeService employees,
                          SellerRevenueClient revenue, ObjectMapper json) {
        this.repo = repo;
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
        String code = "BL%06d".formatted(repo.nextCodeNumber());
        String title = name == null || name.isBlank() ? "Bảng lương tháng " + start.getMonthValue() + "/" + start.getYear() : name.trim();
        repo.insert(id, code, title, start, end, branchId, actor == null ? null : actor.id(), actor == null ? "Hệ thống" : actor.name());
        recalculate(id);
        return id;
    }

    /** Tính lại toàn bộ phiếu lương (giữ thưởng nhập tay). Bảng đã chốt / đã hủy không tính lại. */
    @Transactional
    public void recalculate(UUID id) {
        var p = repo.lockHeader(id);
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
        var emps = repo.employees(start, end, branch);
        boolean needRevenue = emps.stream().anyMatch(o -> o.commissionTableId() != null && o.emp().userId() != null);
        List<SellerRevenue> sales = needRevenue ? revenue.revenue(start, end) : List.of();
        Map<UUID, Map<UUID, Object[]>> rulesByTable = repo.activeCommissionRules();
        Map<UUID, BigDecimal> bonuses = repo.bonuses(id);
        var cells = attendance.cells(start, end, null, null, tk, pr.hourMode()).stream().filter(c -> c.approved()).toList();
        var kept = new java.util.ArrayList<UUID>();
        for (PayrollRepository.PayrollEmployee o : emps) {
            Emp base = o.emp();
            Emp e = new Emp(base.id(), base.code(), base.name(), base.salaryType(), base.amount(), base.overtimePercent(), base.userId(),
                    employees.payItems(base.id(), "ALLOWANCE"), employees.payItems(base.id(), "DEDUCTION"));
            UUID mainBranch = o.mainBranchId();
            List<Integer> workdays = mainBranch == null ? HrSettingsService.ALL_DAYS : settings.workdaysOf(mainBranch);
            int std = PayRates.standardDays(new PayRates.Period(start, end), workdays);
            int employed = PayRates.workingDays(maxDate(start, o.startDate()), minDate(end, o.endDate()), workdays);
            var rules = o.commissionTableId() == null ? Map.<UUID, Object[]>of() : rulesByTable.getOrDefault(o.commissionTableId(), Map.of());
            var mine = e.userId() == null ? List.<SellerRevenue>of() : sales.stream().filter(s -> e.userId().equals(s.sellerId())).toList();
            var slip = PayrollCalculator.compute(new PayrollCalculator.Input(e, cells.stream().filter(c -> c.employeeId().equals(e.id())).toList(),
                    std, employed, tk, pr, mine, rules, d -> settings.holidayMultiplier(holidays, d), bonuses.get(e.id())));
            upsertSlip(id, e, slip);
            kept.add(e.id());
        }
        // nhân viên không còn thuộc bảng lương (đổi chi nhánh, bỏ thiết lập lương) và chưa được trả → bỏ phiếu
        for (UUID emp : repo.unpaidSlipEmployees(id)) {
            if (!kept.contains(emp)) {
                repo.deleteSlip(id, emp);
            }
        }
        repo.markComputed(id);
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
        repo.upsertSlip(payrollId, e, s, details);
    }

    @Transactional
    public void setBonus(UUID payrollId, UUID slipId, BigDecimal bonus) {
        if (repo.setBonus(payrollId, slipId, bonus) == 0) {
            throw BusinessException.notFound("PAYSLIP_NOT_FOUND", "Không tìm thấy phiếu lương");
        }
        recalculate(payrollId);
    }

    @Transactional
    public void lock(UUID id) {
        if (repo.lock(id) == 0) {
            throw BusinessException.badRequest("PAYROLL_NOT_TEMP", "Chỉ chốt được bảng lương đang tạm tính");
        }
    }

    @Transactional
    public void cancel(UUID id) {
        Long payments = repo.countActivePayments(id);
        if (payments != null && payments > 0) {
            throw BusinessException.badRequest("PAYROLL_PAID", "Bảng lương đã có phiếu thanh toán, hãy hủy các phiếu thanh toán trước");
        }
        if (repo.cancel(id) == 0) {
            throw BusinessException.notFound("PAYROLL_NOT_FOUND", "Không tìm thấy bảng lương");
        }
    }
}
