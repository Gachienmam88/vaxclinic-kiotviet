package com.vaxclinic.identity.hr.schedule;

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

    /** Mọi ca (kể cả ngừng hoạt động), theo giờ bắt đầu rồi tên. */
    public List<Shift> findAll() {
        return jdbc.query("select id, name, start_time, end_time, active from hr_shifts order by start_time, name", (rs, i) -> {
            LocalTime s = rs.getObject(3, LocalTime.class);
            LocalTime e = rs.getObject(4, LocalTime.class);
            return new Shift(rs.getObject(1, UUID.class), rs.getString(2), s, e, rs.getBoolean(5), Shift.minutes(s, e));
        });
    }

    public void insert(UUID id, String name, LocalTime start, LocalTime end, boolean active) {
        jdbc.update("insert into hr_shifts(id, name, start_time, end_time, active) values (?,?,?,?,?)", id, name, start, end, active);
    }

    /** Số dòng đã sửa (0 = không có ca). */
    public int update(UUID id, String name, LocalTime start, LocalTime end, boolean active) {
        return jdbc.update("update hr_shifts set name = ?, start_time = ?, end_time = ?, active = ? where id = ?",
                name, start, end, active, id);
    }

    /** Số lần ca được dùng ở lịch làm việc + chấm công. */
    public long usageCount(UUID id) {
        Long used = jdbc.queryForObject("select (select count(*) from hr_schedules where shift_id = ?) + (select count(*) from hr_attendance where shift_id = ?)",
                Long.class, id, id);
        return used == null ? 0 : used;
    }

    public void deactivate(UUID id) {
        jdbc.update("update hr_shifts set active = false where id = ?", id);
    }

    public void delete(UUID id) {
        jdbc.update("delete from hr_shifts where id = ?", id);
    }

    /** Ca đang hoạt động theo tên (không phân biệt hoa thường); null = không có. */
    public UUID findActiveIdByName(String name) {
        return jdbc.query("select id from hr_shifts where lower(name) = lower(?) and active",
                rs -> rs.next() ? rs.getObject(1, UUID.class) : null, name);
    }
}
