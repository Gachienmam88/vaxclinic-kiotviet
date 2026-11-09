package com.vaxclinic.identity.hr.payroll.service;

import com.vaxclinic.identity.hr.attendance.service.AttendanceRules;
import com.vaxclinic.identity.hr.settings.dto.HrSettings.Timekeeping;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;

/** Kỳ lương và đơn giá lương quy đổi (giờ / ngày / ca) dùng chung cho Bảng lương và Lương dự kiến. */
public final class PayRates {

    private PayRates() {
    }

    public record Period(LocalDate start, LocalDate end) {
    }

    /** Kỳ lương hàng tháng chứa ngày date, bắt đầu từ ngày startDay mỗi tháng (VD ngày 1 → 01/10 - 31/10). */
    public static Period periodOf(LocalDate date, int startDay) {
        LocalDate start = date.withDayOfMonth(Math.min(startDay, date.lengthOfMonth()));
        if (start.isAfter(date)) {
            LocalDate prev = date.minusMonths(1);
            start = prev.withDayOfMonth(Math.min(startDay, prev.lengthOfMonth()));
        }
        return new Period(start, start.plusMonths(1).minusDays(1));
    }

    /** Số ngày công chuẩn của kỳ = số ngày trong kỳ rơi vào ngày làm việc của chi nhánh (1 = Thứ hai … 7 = Chủ nhật). */
    public static int standardDays(Period p, List<Integer> workdays) {
        return Math.max(workingDays(p.start(), p.end(), workdays), 1);
    }

    /** Số ngày làm việc (theo thứ trong tuần của chi nhánh) trong [from, to]; from sau to → 0. */
    public static int workingDays(LocalDate from, LocalDate to, List<Integer> workdays) {
        int n = 0;
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            if (workdays.contains(d.getDayOfWeek().getValue())) {
                n++;
            }
        }
        return n;
    }

    /** Lương 1 ngày công (theo ngày công chuẩn / cố định tháng). */
    public static BigDecimal dailyRate(BigDecimal monthly, int standardDays) {
        return monthly.divide(BigDecimal.valueOf(standardDays), 6, RoundingMode.HALF_UP);
    }

    /** Đơn giá 1 giờ để tính làm thêm giờ. shiftMinutes: độ dài ca (lương theo ca). */
    public static BigDecimal hourlyRate(String salaryType, BigDecimal amount, int shiftMinutes, int standardDays, Timekeeping tk) {
        if (salaryType == null || amount == null) {
            return BigDecimal.ZERO;
        }
        return switch (salaryType) {
            case "HOUR" -> amount;
            case "SHIFT" -> amount.multiply(BigDecimal.valueOf(60)).divide(BigDecimal.valueOf(Math.max(shiftMinutes, 1)), 6, RoundingMode.HALF_UP);
            default -> dailyRate(amount, standardDays).divide(tk.standardHours(), 6, RoundingMode.HALF_UP);
        };
    }

    /** Tiền lương cơ bản của 1 ca theo loại lương (chưa nhân hệ số ngày lễ). dayShare: phần ngày công của ca (theo ngày công chuẩn). */
    public static BigDecimal shiftPay(String salaryType, BigDecimal amount, int workedMinutes, BigDecimal dayShare, int standardDays) {
        return switch (salaryType) {
            case "SHIFT" -> workedMinutes > 0 ? amount : BigDecimal.ZERO;
            case "HOUR" -> amount.multiply(BigDecimal.valueOf(workedMinutes)).divide(BigDecimal.valueOf(60), 6, RoundingMode.HALF_UP);
            case "STANDARD_DAY", "FIXED" -> dailyRate(amount, standardDays).multiply(dayShare);
            default -> BigDecimal.ZERO;
        };
    }

    public static BigDecimal dayUnits(int minutes, Timekeeping tk) {
        return AttendanceRules.dayUnits(minutes, tk);
    }

    public static BigDecimal round(BigDecimal v) {
        return v.setScale(0, RoundingMode.HALF_UP);
    }
}
