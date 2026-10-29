package com.vaxclinic.identity.hr.payroll;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vaxclinic.common.error.BusinessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/** Tra cứu bảng lương (danh sách có dòng tổng, chi tiết phiếu lương + lịch sử thanh toán). */
@Repository
public class PayrollQueryRepository {

    /** remaining = Còn cần trả. */
    public record Payroll(UUID id, String code, String name, String payCycle, LocalDate periodStart, LocalDate periodEnd, UUID branchId,
                          String status, BigDecimal total, BigDecimal paid, BigDecimal remaining, String createdByName,
                          Instant createdAt, Instant computedAt, Instant lockedAt) {
    }

    public record Page(List<Payroll> items, long total, int page, int size, BigDecimal sumTotal, BigDecimal sumPaid, BigDecimal sumRemaining) {
    }

    public record Payslip(UUID id, UUID employeeId, String employeeCode, String employeeName, String salaryType, BigDecimal workUnits,
                          BigDecimal baseAmount, BigDecimal overtimeAmount, BigDecimal holidayAmount, BigDecimal allowance,
                          BigDecimal commission, BigDecimal bonus, BigDecimal deduction, BigDecimal insurance, BigDecimal tax,
                          BigDecimal total, BigDecimal paid, BigDecimal advanceBalance, JsonNode details) {
    }

    public record Payment(UUID id, String code, UUID payslipId, String employeeName, BigDecimal cashAmount, BigDecimal advanceAmount,
                          String method, Instant paidAt, String createdByName, boolean cancelled) {
    }

    public record Detail(Payroll payroll, List<Payslip> payslips, List<Payment> payments) {
    }

    private final JdbcTemplate jdbc;
    private final ObjectMapper json;

    public PayrollQueryRepository(JdbcTemplate jdbc, ObjectMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    public Page search(List<String> statuses, String q, int page, int size) {
        var where = new StringBuilder(" where 1=1");
        var args = new ArrayList<Object>();
        if (statuses != null && !statuses.isEmpty()) {
            where.append(" and status in (").append(String.join(",", statuses.stream().map(s -> "?").toList())).append(")");
            args.addAll(statuses);
        }
        if (q != null && !q.isBlank()) {
            where.append(" and (code ilike ? or name ilike ?)");
            String like = "%" + q.trim().replace("%", "\\%").replace("_", "\\_") + "%";
            args.add(like);
            args.add(like);
        }
        var sums = jdbc.queryForMap("select count(*) n, coalesce(sum(total), 0) t, coalesce(sum(paid), 0) p from hr_payrolls" + where, args.toArray());
        int limit = Math.min(Math.max(size, 1), 100);
        args.add(limit);
        args.add((long) Math.max(page, 0) * limit);
        var items = jdbc.query("select * from hr_payrolls" + where + " order by period_start desc, code desc limit ? offset ?",
                (rs, i) -> payroll(rs), args.toArray());
        BigDecimal t = (BigDecimal) sums.get("t");
        BigDecimal p = (BigDecimal) sums.get("p");
        return new Page(items, ((Number) sums.get("n")).longValue(), page, limit, t, p, t.subtract(p));
    }

    public Detail detail(UUID id) {
        var list = jdbc.query("select * from hr_payrolls where id = ?", (rs, i) -> payroll(rs), id);
        if (list.isEmpty()) {
            throw BusinessException.notFound("PAYROLL_NOT_FOUND", "Không tìm thấy bảng lương");
        }
        var slips = jdbc.query("""
                select s.*, (select coalesce(sum(case a.kind when 'ADVANCE' then a.amount else -a.amount end), 0) from hr_advances a
                  where a.employee_id = s.employee_id and not a.cancelled) advance_balance
                from hr_payslips s where s.payroll_id = ? order by s.employee_code""", (rs, i) -> new Payslip(rs.getObject("id", UUID.class),
                rs.getObject("employee_id", UUID.class), rs.getString("employee_code"), rs.getString("employee_name"), rs.getString("salary_type"),
                rs.getBigDecimal("work_units"), rs.getBigDecimal("base_amount"), rs.getBigDecimal("overtime_amount"),
                rs.getBigDecimal("holiday_amount"), rs.getBigDecimal("allowance"), rs.getBigDecimal("commission"), rs.getBigDecimal("bonus"),
                rs.getBigDecimal("deduction"), rs.getBigDecimal("insurance"), rs.getBigDecimal("tax"), rs.getBigDecimal("total"),
                rs.getBigDecimal("paid"), rs.getBigDecimal("advance_balance"), node(rs.getString("details"))), id);
        var pays = jdbc.query("""
                select p.*, s.employee_name from hr_payroll_payments p join hr_payslips s on s.id = p.payslip_id
                where p.payroll_id = ? order by p.paid_at desc""", (rs, i) -> new Payment(rs.getObject("id", UUID.class), rs.getString("code"),
                rs.getObject("payslip_id", UUID.class), rs.getString("employee_name"), rs.getBigDecimal("cash_amount"),
                rs.getBigDecimal("advance_amount"), rs.getString("method"), rs.getTimestamp("paid_at").toInstant(),
                rs.getString("created_by_name"), rs.getBoolean("cancelled")), id);
        return new Detail(list.get(0), slips, pays);
    }

    private JsonNode node(String s) {
        try {
            return s == null ? null : json.readTree(s);
        } catch (JsonProcessingException e) {
            return null;
        }
    }

    private static Payroll payroll(ResultSet rs) throws SQLException {
        BigDecimal total = rs.getBigDecimal("total");
        BigDecimal paid = rs.getBigDecimal("paid");
        return new Payroll(rs.getObject("id", UUID.class), rs.getString("code"), rs.getString("name"), rs.getString("pay_cycle"),
                rs.getObject("period_start", LocalDate.class), rs.getObject("period_end", LocalDate.class), rs.getObject("branch_id", UUID.class),
                rs.getString("status"), total, paid, total.subtract(paid), rs.getString("created_by_name"), ts(rs, "created_at"),
                ts(rs, "computed_at"), ts(rs, "locked_at"));
    }

    private static Instant ts(ResultSet rs, String col) throws SQLException {
        var t = rs.getTimestamp(col);
        return t == null ? null : t.toInstant();
    }
}
