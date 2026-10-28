package com.vaxclinic.identity.hr.settings;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Thiết lập nhân viên (Nhân viên → Thiết lập), lưu trong app_settings theo từng khóa "hr.*".
 * Mọi giá trị số phút / giờ đều là phút (giờ công chuẩn: giờ).
 */
public final class HrSettings {

    private HrSettings() {
    }

    /**
     * Thiết lập chấm công. halfFrom / fullFrom: quy đổi giờ làm → nửa công / 1 công (phút).
     * late/early: chỉ tính đi muộn sau / về sớm trước N phút. otBefore/otAfter: chỉ tính làm thêm khi vào sớm / về muộn hơn N phút;
     * otActualAll: tính toàn bộ thời gian làm thêm thực tế (không trừ ngưỡng).
     */
    public record Timekeeping(@DecimalMin("1") @DecimalMax("24") BigDecimal standardHours, boolean convertEnabled,
                              @Min(0) @Max(1440) int halfFrom, @Min(0) @Max(1440) int fullFrom, boolean lateEarlyForHalf,
                              boolean lateEnabled, @Min(0) @Max(600) int lateAfter,
                              boolean earlyEnabled, @Min(0) @Max(600) int earlyBefore,
                              boolean otBeforeEnabled, @Min(0) @Max(600) int otBefore,
                              boolean otAfterEnabled, @Min(0) @Max(600) int otAfter, boolean otActualAll,
                              boolean singleInOutMultiShift, boolean autoTimekeeping, boolean allowUnscheduled) {
        public static Timekeeping defaults() {
            return new Timekeeping(BigDecimal.valueOf(8), false, 60, 270, false, true, 0, true, 0,
                    true, 0, true, 0, false, false, false, true);
        }
    }

    /**
     * Thiết lập tính lương. hourMode: ACTUAL (giờ thực tế) / SHIFT (giờ trong ca). commissionBase: NET (doanh thu sau giảm) / PAID (thực thu).
     * taxRate / insuranceRate: % đơn giản; taxDeduction: giảm trừ gia cảnh trước khi tính thuế.
     */
    public record Payroll(@Min(1) @Max(28) int startDay, @Pattern(regexp = "ACTUAL|SHIFT") String hourMode,
                          boolean autoCreate, boolean autoUpdate,
                          List<@NotBlank @Size(max = 100) String> allowances, List<@NotBlank @Size(max = 100) String> deductions,
                          boolean taxEnabled, @DecimalMin("0") @DecimalMax("100") BigDecimal taxRate,
                          @DecimalMin("0") BigDecimal taxDeduction,
                          boolean insuranceEnabled, @DecimalMin("0") @DecimalMax("100") BigDecimal insuranceRate,
                          @Pattern(regexp = "NET|PAID") String commissionBase) {
        public static Payroll defaults() {
            return new Payroll(1, "ACTUAL", true, true, List.of(), List.of(), false, BigDecimal.TEN,
                    BigDecimal.valueOf(11_000_000), false, new BigDecimal("10.5"), "NET");
        }
    }

    /** Ngày làm việc trong tuần của 1 chi nhánh: 1 = Thứ hai … 7 = Chủ nhật. */
    public record BranchWorkdays(@NotNull UUID branchId, @NotNull List<@Min(1) @Max(7) Integer> days) {
    }

    /** Kỳ lễ tết: từ ngày → đến hết ngày, hệ số lương (%), VD 300 = gấp 3 lương ngày thường. */
    public record Holiday(UUID id, @NotBlank @Size(max = 100) String name, @NotNull LocalDate from, @NotNull LocalDate to,
                          @NotNull @DecimalMin("0") @DecimalMax("1000") BigDecimal multiplier) {
    }

    /** Chấm công điện thoại: requireQr = bắt buộc quét mã QR đang hiển thị tại chi nhánh (chống chấm hộ từ xa). */
    public record Mobile(boolean enabled, boolean requireQr) {
        public static Mobile defaults() {
            return new Mobile(true, true);
        }
    }

    public record PayItem(@NotBlank @Size(max = 100) String name, @Pattern(regexp = "DAY|MONTH|LATE|EARLY") String kind,
                          @NotNull @DecimalMin("0") BigDecimal amount) {
    }

    /** Mẫu lương: bộ thiết lập lương áp nhanh cho nhân viên (loại lương, mức lương, phụ cấp, giảm trừ, hoa hồng). */
    public record Template(UUID id, @NotBlank @Size(max = 100) String name,
                           @Pattern(regexp = "SHIFT|HOUR|STANDARD_DAY|FIXED") String salaryType,
                           @DecimalMin("0") BigDecimal salaryAmount, @DecimalMin("0") BigDecimal overtimePercent,
                           UUID commissionTableId, List<@Valid PayItem> allowances, List<@Valid PayItem> deductions) {
    }
}
