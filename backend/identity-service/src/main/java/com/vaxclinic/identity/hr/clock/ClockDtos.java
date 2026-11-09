package com.vaxclinic.identity.hr.clock;

import com.vaxclinic.identity.hr.attendance.AttendanceQuery.Cell;
import com.vaxclinic.identity.hr.settings.HrSettings.Mobile;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Request / response của màn Chấm công trên điện thoại (/api/hr/clock). */
public final class ClockDtos {

    private ClockDtos() {
    }

    public record Me(boolean linked, UUID employeeId, String code, String name, Mobile mobile, List<Cell> cells) {
    }

    public record ClockRequest(@NotNull @Pattern(regexp = "IN|OUT") String action, @Size(max = 200) String token) {
    }

    public record ClockResult(String message, String branchName, Me me) {
    }

    public record QrToken(String token, UUID branchId, String branchName, Instant expiresAt, int refreshSeconds) {
    }
}
