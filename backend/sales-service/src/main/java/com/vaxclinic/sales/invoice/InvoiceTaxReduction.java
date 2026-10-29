package com.vaxclinic.sales.invoice;

import com.vaxclinic.sales.invoice.InvoiceDtos.LineInput;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Collections;
import java.util.List;

/**
 * Giảm thuế GTGT theo Nghị quyết 204/2025/QH15 (01/07/2025 – 31/12/2026). Dòng đủ điều kiện do server xác định
 * ({@link TaxReductionPlanner} tra hàng + thiết lập thuế), không theo dữ liệu máy bán hàng gửi lên.
 * - Khấu trừ (DEDUCTION): hàng có cờ giảm thuế + thuế suất 10% → 8%. Giá gồm thuế → giảm = doanh thu × 2 / 110
 *   (110.000 → 108.000, giảm 2.000).
 * - Trực tiếp trên doanh thu (DIRECT): hàng có cờ giảm thuế, giảm 20% tỷ lệ % GTGT của ngành → giảm = doanh thu × tỷ lệ % × 20%
 *   (1.000.000 × 1% × 20% = 2.000).
 * Doanh thu dòng = thành tiền sau khi chia giảm giá hóa đơn theo tỷ lệ; làm tròn 1 lần trên tổng.
 */
public final class InvoiceTaxReduction {

    public static final LocalDate FROM = LocalDate.of(2025, 7, 1);
    public static final LocalDate TO = LocalDate.of(2026, 12, 31);
    public static final String DEDUCTION = "DEDUCTION";
    public static final String DIRECT = "DIRECT";
    private static final ZoneId VN = ZoneId.of("Asia/Ho_Chi_Minh");

    /** Kế hoạch giảm thuế từng dòng: eligible[i]; directRates[i] = tỷ lệ % GTGT ngành (chỉ phương pháp trực tiếp). */
    public record Plan(String method, List<Boolean> eligible, List<BigDecimal> directRates) {

        public static Plan none(int lines) {
            return new Plan(null, Collections.nCopies(lines, false), Collections.nCopies(lines, null));
        }

        public boolean any() {
            return method != null && eligible.contains(true);
        }
    }

    private InvoiceTaxReduction() {
    }

    /** Ngày bán (giờ VN) nằm trong thời gian áp dụng. */
    public static boolean inWindow(Instant at) {
        LocalDate d = (at == null ? Instant.now() : at).atZone(VN).toLocalDate();
        return !d.isBefore(FROM) && !d.isAfter(TO);
    }

    /** Số tiền giảm thuế của hóa đơn (subtotal = tổng tiền hàng, afterDiscount = sau giảm giá hóa đơn). */
    static BigDecimal amount(List<LineInput> lines, Plan plan, BigDecimal subtotal, BigDecimal afterDiscount) {
        if (!plan.any() || subtotal.signum() == 0) {
            return BigDecimal.ZERO;
        }
        BigDecimal ratio = afterDiscount.divide(subtotal, 10, RoundingMode.HALF_UP);
        BigDecimal sum = BigDecimal.ZERO;
        for (int i = 0; i < lines.size(); i++) {
            if (!Boolean.TRUE.equals(plan.eligible().get(i))) {
                continue;
            }
            BigDecimal net = InvoiceMath.lineAmount(lines.get(i)).multiply(ratio);
            sum = sum.add(DIRECT.equals(plan.method())
                    ? net.multiply(plan.directRates().get(i)).multiply(new BigDecimal("0.002")) // × rate% × 20%
                    : net.multiply(BigDecimal.valueOf(2)).divide(BigDecimal.valueOf(110), 10, RoundingMode.HALF_UP));
        }
        return sum.setScale(0, RoundingMode.HALF_UP);
    }
}
