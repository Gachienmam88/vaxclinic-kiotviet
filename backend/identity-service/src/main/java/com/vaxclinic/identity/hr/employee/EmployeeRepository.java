package com.vaxclinic.identity.hr.employee;

import com.vaxclinic.identity.hr.employee.EmployeeDtos.AdvanceItem;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Xóa hồ sơ nhân viên và Nợ / tạm ứng (bảng hr_advances). Chỉ truy cập DB. */
@Repository
public class EmployeeRepository {

    private final JdbcTemplate jdbc;

    public EmployeeRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Số lượt chấm công + phiếu lương + tạm ứng đã phát sinh của nhân viên. */
    public Long usageCount(UUID id) {
        return jdbc.queryForObject("select (select count(*) from hr_attendance where employee_id = ?)"
                + " + (select count(*) from hr_payslips where employee_id = ?) + (select count(*) from hr_advances where employee_id = ?)",
                Long.class, id, id, id);
    }

    public void delete(UUID id) {
        jdbc.update("delete from hr_employees where id = ?", id);
    }

    public List<AdvanceItem> advances(UUID employeeId) {
        return jdbc.query("select id, kind, amount, occurred_at, note, cancelled from hr_advances where employee_id = ? order by occurred_at desc",
                (rs, i) -> new AdvanceItem(rs.getObject(1, UUID.class), rs.getString(2), rs.getBigDecimal(3),
                        rs.getTimestamp(4).toInstant(), rs.getString(5), rs.getBoolean(6)), employeeId);
    }

    public void insertAdvance(UUID id, UUID employeeId, BigDecimal amount, Instant occurredAt, String note, UUID createdBy) {
        jdbc.update("insert into hr_advances(id, employee_id, kind, amount, occurred_at, note, created_by) values (?,?,'ADVANCE',?,?,?,?)",
                id, employeeId, amount, java.sql.Timestamp.from(occurredAt), note, createdBy);
    }

    /** Số kế tiếp của chuỗi mã phiếu chi lương / tạm ứng (hr_payment_code_seq). */
    public Long nextPaymentCodeSeq() {
        return jdbc.queryForObject("select nextval('hr_payment_code_seq')", Long.class);
    }
}
