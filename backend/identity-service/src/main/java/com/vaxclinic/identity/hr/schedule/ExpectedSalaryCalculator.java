package com.vaxclinic.identity.hr.schedule;

import com.vaxclinic.identity.hr.payroll.PayRates;
import com.vaxclinic.identity.hr.settings.HrSettingsService;
import com.vaxclinic.identity.hr.schedule.ScheduleRepository.SalariedEmployee;
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

    private final ScheduleRepository schedules;
    private final HrSettingsService settings;
    private final ShiftRepository shiftRepo;

    public ExpectedSalaryCalculator(ScheduleRepository schedules, HrSettingsService settings, ShiftRepository shiftRepo) {
        this.schedules = schedules;
        this.settings = settings;
        this.shiftRepo = shiftRepo;
    }

    public Map<UUID, BigDecimal> expected(LocalDate from, LocalDate to) {
        var tk = settings.timekeeping();
        int startDay = settings.payroll().startDay();
        var holidays = settings.holidays();
        Map<UUID, Shift> shifts = shiftRepo.findAll().stream().collect(Collectors.toMap(Shift::id, Function.identity()));
        var emps = schedules.salariedWorkingEmployees();
        Map<UUID, BigDecimal> out = new HashMap<>();
        Map<UUID, Map<LocalDate, Integer>> minutesByDay = new HashMap<>();
        Map<UUID, List<Object[]>> slots = new HashMap<>();
        for (var row : schedules.shiftsBetween(from, to)) {
            UUID emp = row.employeeId();
            Shift sh = shifts.get(row.shiftId());
            LocalDate d = row.workDate();
            minutesByDay.computeIfAbsent(emp, k -> new HashMap<>()).merge(d, sh == null ? 0 : sh.minutes(), Integer::sum);
            slots.computeIfAbsent(emp, k -> new java.util.ArrayList<>()).add(new Object[]{sh, d});
        }
        for (SalariedEmployee e : emps) {
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
