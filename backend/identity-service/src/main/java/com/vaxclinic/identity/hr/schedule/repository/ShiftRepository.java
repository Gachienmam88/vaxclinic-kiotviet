package com.vaxclinic.identity.hr.schedule.repository;

import com.vaxclinic.identity.hr.schedule.dto.Shift;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

/** Bảng hr_shifts (ca làm việc). Chỉ truy cập DB. */
@Repository
public class ShiftRepository {

    private final JdbcTemplate jdbc;

    public ShiftRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Mọi ca, sắp theo giờ bắt đầu rồi tên. Dùng chung (tĩnh) cho các màn chấm công / lịch / lương. */
    public static List<Shift> load(JdbcTemplate jdbc) {
        return jdbc.query("select id, name, start_time, end_time, active from hr_shifts order by start_time, name", (rs, i) -> {
            LocalTime s = rs.getObject(3, LocalTime.class);
            LocalTime e = rs.getObject(4, LocalTime.class);
            return new Shift(rs.getObject(1, UUID.class), rs.getString(2), s, e, rs.getBoolean(5), Shift.minutes(s, e));
        });
    }

    public List<Shift> findAll() {
        return load(jdbc);
    }

    public void insert(UUID id, String name, LocalTime startTime, LocalTime endTime, boolean active) {
        jdbc.update("insert into hr_shifts(id, name, start_time, end_time, active) values (?,?,?,?,?)", id, name,
                startTime, endTime, active);
    }

    public int update(UUID id, String name, LocalTime startTime, LocalTime endTime, boolean active) {
        return jdbc.update("update hr_shifts set name = ?, start_time = ?, end_time = ?, active = ? where id = ?", name,
                startTime, endTime, active, id);
    }

    /** Số lịch làm việc + chấm công đang dùng ca. */
    public Long usageCount(UUID id) {
        return jdbc.queryForObject("select (select count(*) from hr_schedules where shift_id = ?) + (select count(*) from hr_attendance where shift_id = ?)",
                Long.class, id, id);
    }

    public void deactivate(UUID id) {
        jdbc.update("update hr_shifts set active = false where id = ?", id);
    }

    public void delete(UUID id) {
        jdbc.update("delete from hr_shifts where id = ?", id);
    }
}
