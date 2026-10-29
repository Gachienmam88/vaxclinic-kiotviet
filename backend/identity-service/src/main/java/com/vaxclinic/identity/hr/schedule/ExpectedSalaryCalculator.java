package com.vaxclinic.identity.hr.schedule;

import com.vaxclinic.identity.hr.payroll.PayRates;
import com.vaxclinic.identity.hr.settings.HrSettingsService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Lương dự kiến (cột cuối màn Lịch làm việc): lương cơ bản nếu nhân viên làm đủ các ca đã xếp trong khoảng ngày,
 * có nhân hệ số ngày lễ. Lương cố định tháng: chia đều theo số ngày của kỳ lương. Chưa thiết lập lương → không có trong map.
 */
@Component
public class ExpectedSalaryCalculator {

    private final JdbcTemplate jdbc;
    private final HrSettingsService settings;
    private final ShiftRepository shiftRepo;

    public ExpectedSalaryCalculator(JdbcTemplate jdbc, HrSettingsService settings, ShiftRepository shiftRepo) {
        this.jdbc = jdbc;
        this.settings = settings;
        this.shiftRepo = shiftRepo;
    }

    private record Emp(UUID id, String type, BigDecimal amount, UUID branch) {
    }

    public Map<UUID, BigDecimal> expected(LocalDate from, LocalDate to) {
        var tk = settings.timekeeping();
        int startDay = settings.payroll().startDay();
        var holidays = settings.holidays();
        Map<UUID, Shift> shifts = shiftRepo.findAll().stream().collect(Collectors.toMap(Shift::id, Function.identity()));
        var emps = jdbc.query("select id, salary_type, salary_amount, main_branch_id from hr_employees where status = 'WORKING' and salary_type is not null",
                (rs, i) -> new Emp(rs.getObject(1, UUID.class), rs.getString(2), rs.getBigDecimal(3), rs.getObject(4, UUID.class)));
        Map<UUID, BigDecimal> out = new HashMap<>();
        Map<UUID, Map<LocalDate, Integer>> minutesByDay = new HashMap<>();
        Map<UUID, List<Object[]>> slots = new HashMap<>();
        jdbc.query("select employee_id, shift_id, work_date from hr_schedules where work_date between ? and ?", rs -> {
            UUID emp = rs.getObject(1, UUID.class);
            Shift sh = shifts.get(rs.getObject(2, UUID.class));
            LocalDate d = rs.getObject(3, LocalDate.class);
            minutesByDay.computeIfAbsent(emp, k -> new HashMap<>()).merge(d, sh == null ? 0 : sh.minutes(), Integer::sum);
            slots.computeIfAbsent(emp, k -> new java.util.ArrayList<>()).add(new Object[]{sh, d});
        }, from, to);
        for (Emp e : emps) {
            List<Integer> workdays = e.branch() == null ? HrSettingsService.ALL_DAYS : settings.workdaysOf(e.branch());
            BigDecimal sum = BigDecimal.ZERO;
            if ("FIXED".equals(e.type())) {
                for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
                    var p = PayRates.periodOf(d, startDay);
                    sum = sum.add(e.amount().divide(BigDecimal.valueOf(ChronoUnit.DAYS.between(p.start(), p.end()) + 1), 6, java.math.RoundingMode.HALF_UP));
                }
            } else if ("STANDARD_DAY".equals(e.type())) {
                for (var day : minutesByDay.getOrDefault(e.id(), Map.of()).entrySet()) {
                    int std = PayRates.standardDays(PayRates.periodOf(day.getKey(), startDay), workdays);
                    sum = sum.add(PayRates.dailyRate(e.amount(), std).multiply(PayRates.dayUnits(day.getValue(), tk))
                            .multiply(multiplier(holidays, day.getKey())));
                }
            } else {
                for (Object[] s : slots.getOrDefault(e.id(), List.of())) {
                    Shift sh = (Shift) s[0];
                    LocalDate d = (LocalDate) s[1];
                    if (sh != null) {
                        sum = sum.add(PayRates.shiftPay(e.type(), e.amount(), sh.minutes(), BigDecimal.ONE, 1).multiply(multiplier(holidays, d)));
                    }
                }
            }
            out.put(e.id(), PayRates.round(sum));
        }
        return out;
    }

    private BigDecimal multiplier(List<com.vaxclinic.identity.hr.settings.HrSettings.Holiday> holidays, LocalDate d) {
        BigDecimal m = settings.holidayMultiplier(holidays, d);
        return m == null ? BigDecimal.ONE : m.divide(BigDecimal.valueOf(100), 6, java.math.RoundingMode.HALF_UP);
    }
}
