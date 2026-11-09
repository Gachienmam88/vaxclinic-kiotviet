package com.vaxclinic.identity.hr.schedule;

import com.vaxclinic.identity.hr.schedule.ScheduleDtos.ScheduleItem;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Bảng hr_schedules (lịch làm việc) + tra cứu mã nhân viên / tên ca khi import. Chỉ truy cập DB. */
@Repository
public class ScheduleRepository {

    private final JdbcTemplate jdbc;

    public ScheduleRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<ScheduleItem> between(LocalDate from, LocalDate to) {
        return jdbc.query("select id, employee_id, shift_id, work_date from hr_schedules where work_date between ? and ? order by work_date",
                (rs, i) -> new ScheduleItem(rs.getObject(1, UUID.class), rs.getObject(2, UUID.class), rs.getObject(3, UUID.class),
                        rs.getObject(4, LocalDate.class)), from, to);
    }

    /** Thêm 1 ca (trùng nhân viên + ca + ngày → bỏ qua); trả số dòng đã thêm (0 / 1). */
    public int insertIfAbsent(UUID employeeId, UUID shiftId, LocalDate date) {
        return jdbc.update("insert into hr_schedules(id, employee_id, shift_id, work_date) values (?,?,?,?) on conflict do nothing",
                UUID.randomUUID(), employeeId, shiftId, date);
    }

    /** 0 hoặc 1 phần tử. */
    public List<ScheduleItem> find(UUID id) {
        return jdbc.query("select employee_id, shift_id, work_date from hr_schedules where id = ?",
                (rs, i) -> new ScheduleItem(id, rs.getObject(1, UUID.class), rs.getObject(2, UUID.class), rs.getObject(3, LocalDate.class)), id);
    }

    /** Xóa các ca cùng nhân viên, cùng ca, cùng thứ trong tuần (isodow) từ ngày from trở đi. */
    public int deleteRepeating(UUID employeeId, UUID shiftId, LocalDate from, int isoDayOfWeek) {
        return jdbc.update("delete from hr_schedules where employee_id = ? and shift_id = ? and work_date >= ? and extract(isodow from work_date) = ?",
                employeeId, shiftId, from, isoDayOfWeek);
    }

    public int delete(UUID id) {
        return jdbc.update("delete from hr_schedules where id = ?", id);
    }

    public UUID employeeIdByCode(String code) {
        return jdbc.query("select id from hr_employees where upper(code) = upper(?)",
                rs -> rs.next() ? rs.getObject(1, UUID.class) : null, code);
    }

    public UUID activeShiftIdByName(String name) {
        return jdbc.query("select id from hr_shifts where lower(name) = lower(?) and active",
                rs -> rs.next() ? rs.getObject(1, UUID.class) : null, name);
    }
}
