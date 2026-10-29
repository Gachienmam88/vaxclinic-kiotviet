package com.vaxclinic.identity.hr.employee;

import com.vaxclinic.identity.hr.employee.EmployeeDtos.AdvanceItem;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Tra cứu / xóa nhân viên (hr_employees), Nợ và tạm ứng (hr_advances), mã phiếu chi HR. Chỉ truy cập DB. */
@Repository
public class EmployeeRepository {

    private final JdbcTemplate jdbc;

    public EmployeeRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Số bản ghi chấm công + phiếu lương + tạm ứng của nhân viên. */
    public long usageCount(UUID id) {
        Long used = jdbc.queryForObject("select (select count(*) from hr_attendance where employee_id = ?)"
                + " + (select count(*) from hr_payslips where employee_id = ?) + (select count(*) from hr_advances where employee_id = ?)",
                Long.class, id, id, id);
        return used == null ? 0 : used;
    }

    public void delete(UUID id) {
        jdbc.update("delete from hr_employees where id = ?", id);
    }

    /** Tìm nhân viên theo mã (không phân biệt hoa thường); null = không có. */
    public UUID findIdByCode(String code) {
        return jdbc.query("select id from hr_employees where upper(code) = upper(?)",
                rs -> rs.next() ? rs.getObject(1, UUID.class) : null, code);
    }

    /** Họ tên nhân viên; null = không có. */
    public String findName(UUID id) {
        return jdbc.query("select name from hr_employees where id = ?", rs -> rs.next() ? rs.getString(1) : null, id);
    }

    /** Mã chấm công (chưa chuẩn hóa) của nhân viên đang làm việc. */
    public record TimekeepingCode(String code, UUID employeeId) {
    }

    public List<TimekeepingCode> workingTimekeepingCodes() {
        return jdbc.query("select timekeeping_code, id from hr_employees where timekeeping_code is not null and status = 'WORKING'",
                (rs, i) -> new TimekeepingCode(rs.getString(1), rs.getObject(2, UUID.class)));
    }

    /** Mới nhất trước. */
    public List<AdvanceItem> advances(UUID employeeId) {
        return jdbc.query("select id, kind, amount, occurred_at, note, cancelled from hr_advances where employee_id = ? order by occurred_at desc",
                (rs, i) -> new AdvanceItem(rs.getObject(1, UUID.class), rs.getString(2), rs.getBigDecimal(3),
                        rs.getTimestamp(4).toInstant(), rs.getString(5), rs.getBoolean(6)), employeeId);
    }

    public void insertAdvance(UUID id, UUID employeeId, BigDecimal amount, Instant at, String note, UUID createdBy) {
        jdbc.update("insert into hr_advances(id, employee_id, kind, amount, occurred_at, note, created_by) values (?,?,'ADVANCE',?,?,?,?)",
                id, employeeId, amount, Timestamp.from(at), note, createdBy);
    }

    /** Số tiếp theo của dãy mã phiếu chi HR (dùng chung tạm ứng / trả lương). */
    public Long nextPaymentCodeNumber() {
        return jdbc.queryForObject("select nextval('hr_payment_code_seq')", Long.class);
    }
}
