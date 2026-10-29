package com.vaxclinic.identity.hr.schedule;

import com.vaxclinic.identity.hr.schedule.ScheduleModels.ScheduleItem;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Bảng hr_schedules (ca đã xếp cho nhân viên theo ngày) + lương nhân viên cho Lương dự kiến. Chỉ truy cập DB. */
@Repository
public class ScheduleRepository {

    /** Lương thiết lập của nhân viên đang làm việc. */
    public record SalariedEmployee(UUID id, String type, BigDecimal amount, UUID branch) {
    }

    /** Ca đã xếp (không kèm id lịch). */
    public record ScheduledShift(UUID employeeId, UUID shiftId, LocalDate workDate) {
    }

    private final JdbcTemplate jdbc;

    public ScheduleRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<ScheduleItem> findBetween(LocalDate from, LocalDate to) {
        return jdbc.query("select id, employee_id, shift_id, work_date from hr_schedules where work_date between ? and ? order by work_date",
                (rs, i) -> new ScheduleItem(rs.getObject(1, UUID.class), rs.getObject(2, UUID.class), rs.getObject(3, UUID.class),
                        rs.getObject(4, LocalDate.class)), from, to);
    }

    public Optional<ScheduleItem> findById(UUID id) {
        return jdbc.query("select employee_id, shift_id, work_date from hr_schedules where id = ?",
                (rs, i) -> new ScheduleItem(id, rs.getObject(1, UUID.class), rs.getObject(2, UUID.class), rs.getObject(3, LocalDate.class)), id)
                .stream().findFirst();
    }

    /** 1 = đã thêm, 0 = đã có (bỏ qua). */
    public int insertIfAbsent(UUID employeeId, UUID shiftId, LocalDate date) {
        return jdbc.update("insert into hr_schedules(id, employee_id, shift_id, work_date) values (?,?,?,?) on conflict do nothing",
                UUID.randomUUID(), employeeId, shiftId, date);
    }

    public int delete(UUID id) {
        return jdbc.update("delete from hr_schedules where id = ?", id);
    }

    /** Xóa các ca cùng nhân viên, cùng ca, cùng thứ trong tuần từ ngày {@code from} trở đi. */
    public int deleteWeeklyFrom(UUID employeeId, UUID shiftId, LocalDate from) {
        return jdbc.update("delete from hr_schedules where employee_id = ? and shift_id = ? and work_date >= ? and extract(isodow from work_date) = ?",
                employeeId, shiftId, from, from.getDayOfWeek().getValue());
    }

    public List<SalariedEmployee> salariedWorkingEmployees() {
        return jdbc.query("select id, salary_type, salary_amount, main_branch_id from hr_employees where status = 'WORKING' and salary_type is not null",
                (rs, i) -> new SalariedEmployee(rs.getObject(1, UUID.class), rs.getString(2), rs.getBigDecimal(3), rs.getObject(4, UUID.class)));
    }

    public List<ScheduledShift> shiftsBetween(LocalDate from, LocalDate to) {
        return jdbc.query("select employee_id, shift_id, work_date from hr_schedules where work_date between ? and ?",
                (rs, i) -> new ScheduledShift(rs.getObject(1, UUID.class), rs.getObject(2, UUID.class), rs.getObject(3, LocalDate.class)),
                from, to);
    }
}
