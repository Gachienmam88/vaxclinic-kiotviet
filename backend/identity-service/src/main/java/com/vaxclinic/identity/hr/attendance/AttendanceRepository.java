package com.vaxclinic.identity.hr.attendance;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.UUID;

/** Xóa / duyệt bản ghi chấm công (hr_attendance). Ghi giờ vào-ra nằm ở {@link AttendanceWriter}. Chỉ truy cập DB. */
@Repository
public class AttendanceRepository {

    private final JdbcTemplate jdbc;

    public AttendanceRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Số dòng đã xóa. */
    public int delete(UUID id) {
        return jdbc.update("delete from hr_attendance where id = ?", id);
    }

    public void approve(UUID id) {
        jdbc.update("update hr_attendance set approved = true, updated_at = now() where id = ?", id);
    }
}
