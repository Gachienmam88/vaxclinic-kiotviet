package com.vaxclinic.identity.hr.payroll.service;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.identity.hr.dto.HrActor;
import com.vaxclinic.identity.hr.client.HrCashflowOutbox;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.sql.Timestamp;
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

    private final JdbcTemplate jdbc;
    private final HrCashflowOutbox outbox;

    public PayrollPaymentService(JdbcTemplate jdbc, HrCashflowOutbox outbox) {
        this.jdbc = jdbc;
        this.outbox = outbox;
    }

    @Transactional
    public List<String> pay(UUID payrollId, List<PayItem> items, String method, Instant paidAt, HrActor actor) {
        var p = jdbc.queryForMap("select code, status, branch_id from hr_payrolls where id = ? for update", payrollId);
        if (!"LOCKED".equals(p.get("status"))) {
            throw BusinessException.badRequest("PAYROLL_NOT_LOCKED", "Chỉ thanh toán được bảng lương đã chốt");
        }
        UUID fallbackBranch = p.get("branch_id") != null ? (UUID) p.get("branch_id")
                : jdbc.queryForObject("select id from branches where active order by code limit 1", UUID.class);
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
            Map<String, Object> s = jdbc.queryForMap("""
                    select s.employee_id, s.employee_code, s.employee_name, s.total, s.paid, e.main_branch_id, e.phone
                    from hr_payslips s join hr_employees e on e.id = s.employee_id where s.id = ? and s.payroll_id = ? for update of s""",
                    it.payslipId(), payrollId);
            BigDecimal remaining = ((BigDecimal) s.get("total")).subtract((BigDecimal) s.get("paid"));
            if (cash.add(adv).compareTo(remaining) > 0) {
                throw BusinessException.badRequest("OVERPAY", "Số tiền trả " + s.get("employee_name") + " vượt quá số còn cần trả " + HrActor.money(remaining));
            }
            UUID emp = (UUID) s.get("employee_id");
            BigDecimal debt = jdbc.queryForObject("select coalesce(sum(case kind when 'ADVANCE' then amount else -amount end), 0) from hr_advances"
                    + " where employee_id = ? and not cancelled", BigDecimal.class, emp);
            if (adv.compareTo(debt) > 0) {
                throw BusinessException.badRequest("ADVANCE_EXCEEDED", s.get("employee_name") + " chỉ còn " + HrActor.money(debt) + " tạm ứng để khấu trừ");
            }
            UUID payId = UUID.randomUUID();
            String code = "PCPL%06d".formatted(jdbc.queryForObject("select nextval('hr_payment_code_seq')", Long.class));
            jdbc.update("""
                    insert into hr_payroll_payments(id, code, payroll_id, payslip_id, employee_id, cash_amount, advance_amount, method, paid_at,
                      created_by, created_by_name) values (?,?,?,?,?,?,?,?,?,?,?)""",
                    payId, code, payrollId, it.payslipId(), emp, cash, adv, method, Timestamp.from(paidAt), actor.id(), actor.name());
            if (adv.signum() > 0) {
                jdbc.update("insert into hr_advances(id, employee_id, kind, amount, occurred_at, payment_id, note, created_by) values (?,?,'DEDUCT',?,?,?,?,?)",
                        UUID.randomUUID(), emp, adv, Timestamp.from(paidAt), payId, "Khấu trừ khi trả lương " + p.get("code"), actor.id());
            }
            jdbc.update("update hr_payslips set paid = paid + ? where id = ?", cash.add(adv), it.payslipId());
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
        var rows = jdbc.queryForList("select payroll_id, payslip_id, cash_amount, advance_amount, cancelled, code from hr_payroll_payments where id = ? for update", paymentId);
        if (rows.isEmpty() || Boolean.TRUE.equals(rows.get(0).get("cancelled"))) {
            throw BusinessException.notFound("PAYMENT_NOT_FOUND", "Không tìm thấy phiếu thanh toán");
        }
        var r = rows.get(0);
        BigDecimal amount = ((BigDecimal) r.get("cash_amount")).add((BigDecimal) r.get("advance_amount"));
        jdbc.update("update hr_payroll_payments set cancelled = true where id = ?", paymentId);
        jdbc.update("update hr_advances set cancelled = true where payment_id = ?", paymentId);
        jdbc.update("update hr_payslips set paid = paid - ? where id = ?", amount, r.get("payslip_id"));
        if (((BigDecimal) r.get("cash_amount")).signum() > 0) {
            outbox.cancelled(SOURCE, paymentId);
        }
        refreshPaid((UUID) r.get("payroll_id"));
        return (String) r.get("code");
    }

    private void refreshPaid(UUID payrollId) {
        jdbc.update("update hr_payrolls set paid = (select coalesce(sum(paid), 0) from hr_payslips where payroll_id = ?) where id = ?", payrollId, payrollId);
    }

    private static BigDecimal nz(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }
}
