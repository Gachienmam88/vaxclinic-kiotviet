package com.vaxclinic.identity.hr.attendance;

import com.vaxclinic.common.settings.ShopSettings;
import com.vaxclinic.identity.hr.settings.HrSettings.Timekeeping;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;

/**
 * Quy tắc chấm công (thuần, không truy cập DB): trạng thái ô chấm công, số phút đi muộn / về sớm / làm thêm / làm việc.
 * Trạng thái: ON_TIME (đúng giờ), LATE_EARLY (đi muộn / về sớm), MISSING (chấm công thiếu), NOT_CHECKED (chưa chấm công),
 * ABSENT (nghỉ làm: absence PAID có phép / UNPAID không phép).
 */
public final class AttendanceRules {

    private AttendanceRules() {
    }

    public record Evaluation(String status, int workedMinutes, int lateMinutes, int earlyMinutes, int otMinutes) {
        public boolean late() {
            return lateMinutes > 0;
        }

        public boolean early() {
            return earlyMinutes > 0;
        }
    }

    public static Instant shiftStart(LocalDate date, LocalTime start) {
        return date.atTime(start).atZone(ShopSettings.ZONE).toInstant();
    }

    /** Giờ kết thúc ca; ca qua đêm (kết thúc ≤ bắt đầu) kết thúc vào ngày hôm sau. */
    public static Instant shiftEnd(LocalDate date, LocalTime start, LocalTime end) {
        LocalDate d = end.isAfter(start) ? date : date.plusDays(1);
        return d.atTime(end).atZone(ShopSettings.ZONE).toInstant();
    }

    /** hourMode: ACTUAL (giờ thực tế: ra − vào, trừ phần đã tính làm thêm) / SHIFT (chỉ giờ nằm trong ca). */
    public static Evaluation evaluate(LocalDate date, LocalTime start, LocalTime end, Instant in, Instant out, String absence,
                                      Timekeeping tk, String hourMode) {
        Instant s = shiftStart(date, start);
        Instant e = shiftEnd(date, start, end);
        int shiftMinutes = minutes(s, e);
        if (absence != null) {
            return new Evaluation("ABSENT", "PAID".equals(absence) ? shiftMinutes : 0, 0, 0, 0);
        }
        if (in == null && out == null) {
            return new Evaluation("NOT_CHECKED", 0, 0, 0, 0);
        }
        int late = in != null && tk.lateEnabled() && in.isAfter(s.plusSeconds(tk.lateAfter() * 60L)) ? minutes(s, in) : 0;
        int early = out != null && tk.earlyEnabled() && out.isBefore(e.minusSeconds(tk.earlyBefore() * 60L)) ? minutes(out, e) : 0;
        if (in == null || out == null || !out.isAfter(in)) {
            return new Evaluation("MISSING", 0, late, early, 0);
        }
        int ot = 0;
        if (tk.otBeforeEnabled() && in.isBefore(s)) {
            int extra = minutes(in, s);
            ot += extra > tk.otBefore() ? (tk.otActualAll() ? extra : extra - tk.otBefore()) : 0;
        }
        if (tk.otAfterEnabled() && out.isAfter(e)) {
            int extra = minutes(e, out);
            ot += extra > tk.otAfter() ? (tk.otActualAll() ? extra : extra - tk.otAfter()) : 0;
        }
        Instant from = in.isAfter(s) ? in : s;
        Instant to = out.isBefore(e) ? out : e;
        int inShift = to.isAfter(from) ? minutes(from, to) : 0;
        int worked = "SHIFT".equals(hourMode) ? inShift : Math.max(0, minutes(in, out) - ot);
        return new Evaluation(late > 0 || early > 0 ? "LATE_EARLY" : "ON_TIME", worked, late, early, ot);
    }

    /** Quy đổi số phút làm trong ngày → số ngày công (lương theo ngày công chuẩn). */
    public static BigDecimal dayUnits(int minutes, Timekeeping tk) {
        if (minutes <= 0) {
            return BigDecimal.ZERO;
        }
        if (tk.convertEnabled()) {
            return minutes >= tk.fullFrom() ? BigDecimal.ONE : minutes >= tk.halfFrom() ? new BigDecimal("0.5") : BigDecimal.ZERO;
        }
        BigDecimal std = tk.standardHours().multiply(BigDecimal.valueOf(60));
        return BigDecimal.valueOf(minutes).divide(std, 4, RoundingMode.HALF_UP).min(BigDecimal.ONE);
    }

    private static int minutes(Instant a, Instant b) {
        return (int) Duration.between(a, b).toMinutes();
    }
}
