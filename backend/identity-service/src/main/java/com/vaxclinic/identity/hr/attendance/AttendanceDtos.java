package com.vaxclinic.identity.hr.attendance;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

/** Request / response của Bảng chấm công (/api/hr/attendance) và nhập file máy chấm công. */
public final class AttendanceDtos {

    private AttendanceDtos() {
    }

    /** checkIn / checkOut: giờ "HH:mm" trong ngày làm việc (ca qua đêm: giờ trước giờ bắt đầu ca → sang ngày hôm sau). */
    public record ManualRequest(@NotNull UUID employeeId, @NotNull UUID shiftId, @NotNull LocalDate date,
                                LocalTime checkIn, LocalTime checkOut, @Pattern(regexp = "PAID|UNPAID") String absence,
                                @Size(max = 300) String note, boolean approved) {
    }

    public record ApproveRequest(@NotNull LocalDate from, @NotNull LocalDate to, UUID branchId, List<UUID> ids) {
    }

    public record ImportResult(int rows, int punches, int records, List<String> unknownCodes, int unmatched, List<String> errors) {
    }
}
