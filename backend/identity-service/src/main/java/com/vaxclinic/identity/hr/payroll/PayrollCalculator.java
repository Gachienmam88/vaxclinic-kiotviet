package com.vaxclinic.identity.hr.payroll;

import com.vaxclinic.identity.hr.attendance.AttendanceQuery.Cell;
import com.vaxclinic.identity.hr.commission.SellerRevenueClient.SellerRevenue;
import com.vaxclinic.identity.hr.settings.HrSettings.Payroll;
import com.vaxclinic.identity.hr.settings.HrSettings.PayItem;
import com.vaxclinic.identity.hr.settings.HrSettings.Timekeeping;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;
import java.util.function.Function;

/**
 * Tính phiếu lương 1 nhân viên cho 1 kỳ từ các ô chấm công ĐÃ DUYỆT:
 * lương chính theo loại lương, làm thêm giờ (× % lương làm thêm), phụ trội ngày lễ (× hệ số − 1), phụ cấp, giảm trừ
 * (đi muộn / về sớm mỗi lần, cố định), hoa hồng theo bảng hoa hồng, thưởng nhập tay, BHXH và thuế TNCN (nếu bật).
 */
public final class PayrollCalculator {

    private PayrollCalculator() {
    }

    public record Emp(UUID id, String code, String name, String salaryType, BigDecimal amount, BigDecimal overtimePercent,
                      UUID userId, List<PayItem> allowances, List<PayItem> deductions) {
    }

    /** rules: productId → [rateType, value] của bảng hoa hồng nhân viên áp dụng. holidayOf: ngày → hệ số % (null = ngày thường). */
    public record Input(Emp emp, List<Cell> cells, int standardDays, Timekeeping tk, Payroll pr, List<SellerRevenue> revenue,
                        Map<UUID, Object[]> rules, Function<LocalDate, BigDecimal> holidayOf, BigDecimal bonus) {
    }

    public record Slip(BigDecimal workUnits, BigDecimal base, BigDecimal overtime, BigDecimal holiday, BigDecimal allowance,
                       BigDecimal commission, BigDecimal bonus, BigDecimal deduction, BigDecimal insurance, BigDecimal tax,
                       BigDecimal total, Map<String, Object> details) {
    }

    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    public static Slip compute(Input in) {
        Emp e = in.emp();
        String type = e.salaryType();
        BigDecimal amount = e.amount() == null ? BigDecimal.ZERO : e.amount();
        Map<LocalDate, Integer> minutesByDay = new TreeMap<>();
        for (Cell c : in.cells()) {
            minutesByDay.merge(c.date(), c.workedMinutes(), Integer::sum);
        }
        BigDecimal units = BigDecimal.ZERO, base = BigDecimal.ZERO, holiday = BigDecimal.ZERO, overtime = BigDecimal.ZERO;
        int late = 0, early = 0, otMinutes = 0;
        Map<LocalDate, BigDecimal> dayShare = new TreeMap<>();
        minutesByDay.forEach((d, m) -> dayShare.put(d, PayRates.dayUnits(m, in.tk())));
        boolean byDay = "STANDARD_DAY".equals(type) || "FIXED".equals(type);
        if (byDay) {
            BigDecimal daily = PayRates.dailyRate(amount, in.standardDays());
            for (var d : dayShare.entrySet()) {
                BigDecimal pay = daily.multiply(d.getValue());
                units = units.add(d.getValue());
                if ("STANDARD_DAY".equals(type)) {
                    base = base.add(pay);
                }
                holiday = holiday.add(pay.multiply(extra(in.holidayOf().apply(d.getKey()))));
            }
            if ("FIXED".equals(type)) {
                base = amount;
            }
        }
        for (Cell c : in.cells()) {
            BigDecimal mult = in.holidayOf().apply(c.date());
            if (!byDay && c.workedMinutes() > 0) {
                BigDecimal pay = PayRates.shiftPay(type, amount, c.workedMinutes(), BigDecimal.ONE, in.standardDays());
                base = base.add(pay);
                holiday = holiday.add(pay.multiply(extra(mult)));
                units = units.add("SHIFT".equals(type) ? BigDecimal.ONE
                        : BigDecimal.valueOf(c.workedMinutes()).divide(BigDecimal.valueOf(60), 2, RoundingMode.HALF_UP));
            }
            boolean halfDayExempt = byDay && in.tk().convertEnabled() && !in.tk().lateEarlyForHalf()
                    && new BigDecimal("0.5").compareTo(dayShare.getOrDefault(c.date(), BigDecimal.ZERO)) == 0;
            if (!halfDayExempt) {
                late += c.lateMinutes() > 0 ? 1 : 0;
                early += c.earlyMinutes() > 0 ? 1 : 0;
            }
            if (c.otMinutes() > 0) {
                otMinutes += c.otMinutes();
                BigDecimal rate = PayRates.hourlyRate(type, amount, minutes(c), in.standardDays(), in.tk());
                overtime = overtime.add(rate.multiply(BigDecimal.valueOf(c.otMinutes())).divide(BigDecimal.valueOf(60), 6, RoundingMode.HALF_UP)
                        .multiply(e.overtimePercent()).divide(HUNDRED, 6, RoundingMode.HALF_UP).multiply(mult == null ? BigDecimal.ONE : mult.divide(HUNDRED)));
            }
        }
        long workedDays = minutesByDay.values().stream().filter(m -> m > 0).count();
        var details = new LinkedHashMap<String, Object>();
        BigDecimal allowance = items(e.allowances(), Map.of("DAY", BigDecimal.valueOf(workedDays), "MONTH", BigDecimal.ONE), details, "allowances");
        BigDecimal deduction = items(e.deductions(), Map.of("LATE", BigDecimal.valueOf(late), "EARLY", BigDecimal.valueOf(early),
                "MONTH", BigDecimal.ONE), details, "deductions");
        BigDecimal commission = commission(in, details);
        BigDecimal bonus = in.bonus() == null ? BigDecimal.ZERO : in.bonus();
        base = PayRates.round(base);
        overtime = PayRates.round(overtime);
        holiday = PayRates.round(holiday);
        BigDecimal gross = base.add(overtime).add(holiday).add(allowance).add(commission).add(bonus).subtract(deduction);
        BigDecimal insurance = BigDecimal.ZERO, tax = BigDecimal.ZERO;
        if (in.pr().insuranceEnabled()) {
            BigDecimal insBase = byDay ? amount : base;
            insurance = PayRates.round(insBase.multiply(in.pr().insuranceRate()).divide(HUNDRED, 6, RoundingMode.HALF_UP));
        }
        if (in.pr().taxEnabled()) {
            BigDecimal taxable = gross.subtract(insurance).subtract(in.pr().taxDeduction());
            tax = taxable.signum() > 0 ? PayRates.round(taxable.multiply(in.pr().taxRate()).divide(HUNDRED, 6, RoundingMode.HALF_UP)) : BigDecimal.ZERO;
        }
        BigDecimal total = gross.subtract(insurance).subtract(tax).max(BigDecimal.ZERO);
        details.put("standardDays", in.standardDays());
        details.put("workedDays", workedDays);
        details.put("lateCount", late);
        details.put("earlyCount", early);
        details.put("overtimeMinutes", otMinutes);
        details.put("shifts", in.cells().size());
        return new Slip(units.setScale(2, RoundingMode.HALF_UP), base, overtime, holiday, allowance, commission, bonus, deduction,
                insurance, tax, total, details);
    }

    private static int minutes(Cell c) {
        int m = (int) java.time.Duration.between(c.shiftStart(), c.shiftEnd()).toMinutes();
        return m <= 0 ? m + 1440 : m;
    }

    /** Phần phụ trội ngày lễ: hệ số 200% → trả thêm 100% lương ngày thường. */
    private static BigDecimal extra(BigDecimal multiplierPercent) {
        return multiplierPercent == null ? BigDecimal.ZERO
                : multiplierPercent.subtract(HUNDRED).max(BigDecimal.ZERO).divide(HUNDRED, 6, RoundingMode.HALF_UP);
    }

    private static BigDecimal items(List<PayItem> items, Map<String, BigDecimal> qty, Map<String, Object> details, String key) {
        BigDecimal sum = BigDecimal.ZERO;
        var lines = new ArrayList<Map<String, Object>>();
        for (PayItem it : items) {
            BigDecimal v = it.amount().multiply(qty.getOrDefault(it.kind(), BigDecimal.ZERO));
            sum = sum.add(v);
            lines.add(Map.of("name", it.name(), "kind", it.kind(), "amount", PayRates.round(v)));
        }
        details.put(key, lines);
        return PayRates.round(sum);
    }

    private static BigDecimal commission(Input in, Map<String, Object> details) {
        BigDecimal sum = BigDecimal.ZERO;
        var lines = new ArrayList<Map<String, Object>>();
        boolean paid = "PAID".equals(in.pr().commissionBase());
        for (SellerRevenue r : in.revenue()) {
            Object[] rule = in.rules().get(r.productId());
            if (rule == null) {
                continue;
            }
            BigDecimal revenue = paid ? r.paidRevenue() : r.netRevenue();
            BigDecimal v = "AMOUNT".equals(rule[0]) ? r.quantity().multiply((BigDecimal) rule[1])
                    : revenue.multiply((BigDecimal) rule[1]).divide(HUNDRED, 6, RoundingMode.HALF_UP);
            v = PayRates.round(v);
            sum = sum.add(v);
            lines.add(Map.of("productCode", String.valueOf(r.productCode()), "productName", String.valueOf(r.productName()),
                    "quantity", r.quantity(), "revenue", revenue, "commission", v));
        }
        details.put("commissions", lines);
        return sum;
    }
}
