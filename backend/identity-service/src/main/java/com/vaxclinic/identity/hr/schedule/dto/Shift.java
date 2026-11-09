package com.vaxclinic.identity.hr.schedule.dto;

import java.time.Duration;
import java.time.LocalTime;
import java.util.UUID;

/** Ca làm việc. minutes: độ dài ca (ca qua đêm tính sang ngày hôm sau). */
public record Shift(UUID id, String name, LocalTime startTime, LocalTime endTime, boolean active, int minutes) {
    public static int minutes(LocalTime start, LocalTime end) {
        long m = Duration.between(start, end).toMinutes();
        return (int) (m <= 0 ? m + 1440 : m);
    }
}
