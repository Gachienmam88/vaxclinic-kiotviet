package com.vaxclinic.identity.hr.payroll;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Thanh toán bảng lương (hr_payroll_payments) + khấu trừ tạm ứng (hr_advances) + số đã trả của phiếu / bảng lương. Chỉ truy cập DB. */
@Repository
public class PayrollPaymentRepository {

    private final JdbcTemplate jdbc;

    public PayrollPaymentRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Khóa dòng bảng lương (code, status, branch_id). */
    public Map<String, Object> lockPayroll(UUID payrollId) {
        return jdbc.queryForMap("select code, status, branch_id from hr_payrolls where id = ? for update", payrollId);
    }

    /** Chi nhánh đang hoạt động đầu tiên theo mã. */
    public UUID firstActiveBranch() {
        return jdbc.queryForObject("select id from branches where active order by code limit 1", UUID.class);
    }

    /** Khóa phiếu lương, kèm chi nhánh chính / SĐT nhân viên. */
    public Map<String, Object> lockPayslip(UUID payslipId, UUID payrollId) {
        return jdbc.queryForMap("""
                select s.employee_id, s.employee_code, s.employee_name, s.total, s.paid, e.main_branch_id, e.phone
                from hr_payslips s join hr_employees e on e.id = s.employee_id where s.id = ? and s.payroll_id = ? for update of s""",
                payslipId, payrollId);
    }

    /** Số dư tạm ứng còn khấu trừ được. */
    public BigDecimal advanceBalance(UUID employeeId) {
        return jdbc.queryForObject("select coalesce(sum(case kind when 'ADVANCE' then amount else -amount end), 0) from hr_advances"
                + " where employee_id = ? and not cancelled", BigDecimal.class, employeeId);
    }

    public void insertPayment(UUID id, String code, UUID payrollId, UUID payslipId, UUID employeeId, BigDecimal cash, BigDecimal advance,
                              String method, Instant paidAt, UUID createdBy, String createdByName) {
        jdbc.update("""
                insert into hr_payroll_payments(id, code, payroll_id, payslip_id, employee_id, cash_amount, advance_amount, method, paid_at,
                  created_by, created_by_name) values (?,?,?,?,?,?,?,?,?,?,?)""",
                id, code, payrollId, payslipId, employeeId, cash, advance, method, Timestamp.from(paidAt), createdBy, createdByName);
    }

    public void insertDeduction(UUID employeeId, BigDecimal amount, Instant at, UUID paymentId, String note, UUID createdBy) {
        jdbc.update("insert into hr_advances(id, employee_id, kind, amount, occurred_at, payment_id, note, created_by) values (?,?,'DEDUCT',?,?,?,?,?)",
                UUID.randomUUID(), employeeId, amount, Timestamp.from(at), paymentId, note, createdBy);
    }

    /** Cộng vào số đã trả của phiếu lương. */
    public void addPaid(UUID payslipId, BigDecimal amount) {
        jdbc.update("update hr_payslips set paid = paid + ? where id = ?", amount, payslipId);
    }

    /** Khóa phiếu thanh toán; rỗng = không có. */
    public List<Map<String, Object>> lockPayment(UUID paymentId) {
        return jdbc.queryForList("select payroll_id, payslip_id, cash_amount, advance_amount, cancelled, code from hr_payroll_payments where id = ? for update", paymentId);
    }

    /** Hủy phiếu thanh toán và khoản khấu trừ tạm ứng đi kèm. */
    public void cancelPayment(UUID paymentId) {
        jdbc.update("update hr_payroll_payments set cancelled = true where id = ?", paymentId);
        jdbc.update("update hr_advances set cancelled = true where payment_id = ?", paymentId);
    }

    /** Trừ khỏi số đã trả của phiếu lương. */
    public void subtractPaid(Object payslipId, BigDecimal amount) {
        jdbc.update("update hr_payslips set paid = paid - ? where id = ?", amount, payslipId);
    }

    /** Số đã trả của bảng lương = tổng đã trả các phiếu lương. */
    public void refreshPaid(UUID payrollId) {
        jdbc.update("update hr_payrolls set paid = (select coalesce(sum(paid), 0) from hr_payslips where payroll_id = ?) where id = ?", payrollId, payrollId);
    }
}
