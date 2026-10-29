package com.vaxclinic.identity.hr.payroll;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.identity.hr.HrActor;
import com.vaxclinic.identity.hr.HrCashflowOutbox;
import com.vaxclinic.identity.hr.employee.EmployeeRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Thanh toán bảng lương đã chốt: mỗi phiếu lương trả 1 phần / toàn bộ. cashAmount → phiếu chi "Chi trả lương nhân viên"
 * trong Sổ quỹ (qua outbox); advanceAmount → trừ vào "Nợ và tạm ứng" của nhân viên. Hủy thanh toán → hủy phiếu chi.
 */
@Service
public class PayrollPaymentService {

    public record PayItem(UUID payslipId, BigDecimal cashAmount, BigDecimal advanceAmount) {
    }

    public static final String SOURCE = "PAYROLL";

    private final PayrollPaymentRepository repo;
    private final EmployeeRepository employees;
    private final HrCashflowOutbox outbox;

    public PayrollPaymentService(PayrollPaymentRepository repo, EmployeeRepository employees, HrCashflowOutbox outbox) {
        this.repo = repo;
        this.employees = employees;
        this.outbox = outbox;
    }

    @Transactional
    public List<String> pay(UUID payrollId, List<PayItem> items, String method, Instant paidAt, HrActor actor) {
        var p = repo.lockPayroll(payrollId);
        if (!"LOCKED".equals(p.get("status"))) {
            throw BusinessException.badRequest("PAYROLL_NOT_LOCKED", "Chỉ thanh toán được bảng lương đã chốt");
        }
        UUID fallbackBranch = p.get("branch_id") != null ? (UUID) p.get("branch_id")
                : repo.firstActiveBranch();
        var codes = new java.util.ArrayList<String>();
        for (PayItem it : items) {
            BigDecimal cash = nz(it.cashAmount());
            BigDecimal adv = nz(it.advanceAmount());
            if (cash.signum() < 0 || adv.signum() < 0) {
                throw BusinessException.badRequest("INVALID_AMOUNT", "Số tiền thanh toán không được âm");
            }
            if (cash.add(adv).signum() == 0) {
                continue;
            }
            Map<String, Object> s = repo.lockPayslip(it.payslipId(), payrollId);
            BigDecimal remaining = ((BigDecimal) s.get("total")).subtract((BigDecimal) s.get("paid"));
            if (cash.add(adv).compareTo(remaining) > 0) {
                throw BusinessException.badRequest("OVERPAY", "Số tiền trả " + s.get("employee_name") + " vượt quá số còn cần trả " + HrActor.money(remaining));
            }
            UUID emp = (UUID) s.get("employee_id");
            BigDecimal debt = repo.advanceBalance(emp);
            if (adv.compareTo(debt) > 0) {
                throw BusinessException.badRequest("ADVANCE_EXCEEDED", s.get("employee_name") + " chỉ còn " + HrActor.money(debt) + " tạm ứng để khấu trừ");
            }
            UUID payId = UUID.randomUUID();
            String code = "PCPL%06d".formatted(employees.nextPaymentCodeNumber());
            repo.insertPayment(payId, code, payrollId, it.payslipId(), emp, cash, adv, method, paidAt, actor.id(), actor.name());
            if (adv.signum() > 0) {
                repo.insertDeduction(emp, adv, paidAt, payId, "Khấu trừ khi trả lương " + p.get("code"), actor.id());
            }
            repo.addPaid(it.payslipId(), cash.add(adv));
            UUID branch = s.get("main_branch_id") != null ? (UUID) s.get("main_branch_id") : fallbackBranch;
            outbox.paid(new HrCashflowOutbox.Payment(SOURCE, payId, code, "BANK".equals(method) ? "BANK" : "CASH", "Chi trả lương nhân viên",
                    cash, paidAt, branch, emp, (String) s.get("employee_name"), (String) s.get("phone"), actor,
                    "Trả lương " + p.get("code") + " cho " + s.get("employee_code") + " - " + s.get("employee_name")));
            codes.add(code);
        }
        refreshPaid(payrollId);
        return codes;
    }

    @Transactional
    public String cancel(UUID paymentId) {
        var rows = repo.lockPayment(paymentId);
        if (rows.isEmpty() || Boolean.TRUE.equals(rows.get(0).get("cancelled"))) {
            throw BusinessException.notFound("PAYMENT_NOT_FOUND", "Không tìm thấy phiếu thanh toán");
        }
        var r = rows.get(0);
        BigDecimal amount = ((BigDecimal) r.get("cash_amount")).add((BigDecimal) r.get("advance_amount"));
        repo.cancelPayment(paymentId);
        repo.subtractPaid(r.get("payslip_id"), amount);
        if (((BigDecimal) r.get("cash_amount")).signum() > 0) {
            outbox.cancelled(SOURCE, paymentId);
        }
        refreshPaid((UUID) r.get("payroll_id"));
        return (String) r.get("code");
    }

    private void refreshPaid(UUID payrollId) {
        repo.refreshPaid(payrollId);
    }

    private static BigDecimal nz(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }
}
