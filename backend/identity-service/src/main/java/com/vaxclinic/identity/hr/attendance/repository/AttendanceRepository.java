package com.vaxclinic.identity.hr.attendance.repository;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/** Bảng hr_attendance (sửa tay, xóa, duyệt) + tra cứu nhân viên cho chấm công. Chỉ truy cập DB. */
@Repository
public class AttendanceRepository {

    /** Mã chấm công (chưa chuẩn hóa) của nhân viên đang làm việc. */
    public record TimekeepingCode(String code, UUID employeeId) {
    }

    private final JdbcTemplate jdbc;

    public AttendanceRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public String employeeName(UUID employeeId) {
        return jdbc.query("select name from hr_employees where id = ?", rs -> rs.next() ? rs.getString(1) : null, employeeId);
    }

    public int delete(UUID id) {
        return jdbc.update("delete from hr_attendance where id = ?", id);
    }

    public void approve(UUID id) {
        jdbc.update("update hr_attendance set approved = true, updated_at = now() where id = ?", id);
    }

    /** Theo thứ tự DB trả về. */
    public List<TimekeepingCode> workingTimekeepingCodes() {
        var out = new ArrayList<TimekeepingCode>();
        jdbc.query("select timekeeping_code, id from hr_employees where timekeeping_code is not null and status = 'WORKING'",
                rs -> { out.add(new TimekeepingCode(rs.getString(1), rs.getObject(2, UUID.class))); });
        return out;
    }
}
