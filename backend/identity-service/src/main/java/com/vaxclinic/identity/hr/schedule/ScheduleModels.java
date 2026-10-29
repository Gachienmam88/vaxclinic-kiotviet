package com.vaxclinic.identity.hr.schedule;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** DTO màn Lịch làm việc. */
public final class ScheduleModels {

    private ScheduleModels() {
    }

    public record ScheduleItem(UUID id, UUID employeeId, UUID shiftId, LocalDate date) {
    }

    public record WeekView(List<ScheduleItem> items, Map<UUID, BigDecimal> expected) {
    }

    /** repeatWeekly: lặp các thứ trong weekdays (1 = Thứ hai … 7 = Chủ nhật) từ date tới until (tối đa 1 năm). */
    public record ScheduleRequest(@NotEmpty List<UUID> employeeIds, @NotEmpty List<UUID> shiftIds, @NotNull LocalDate date,
                                  boolean repeatWeekly, List<@Min(1) @Max(7) Integer> weekdays, LocalDate until) {
    }

    public record ImportRow(String employeeCode, LocalDate date, String shiftName) {
    }

    public record ImportRequest(@NotNull @Size(max = 5000) List<ImportRow> rows) {
    }
}
