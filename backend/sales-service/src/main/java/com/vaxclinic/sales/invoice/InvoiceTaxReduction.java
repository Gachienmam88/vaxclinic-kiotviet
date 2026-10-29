package com.vaxclinic.sales.invoice;

import com.vaxclinic.sales.invoice.InvoiceDtos.LineInput;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

/**
 * Giảm thuế GTGT theo Nghị quyết 204/2025/QH15 (01/07/2025 – 31/12/2026): chỉ dòng hàng có cờ "Áp dụng giảm thuế" và thuế suất
 * 10% (VAT10) được tính 8%; dòng khác giữ nguyên. Giá bán đã gồm thuế: phần giảm = giá sau giảm giá × 2 / 110
 * (VD 110.000 gồm 10% → 108.000 gồm 8%, giảm 2.000). Giảm giá hóa đơn chia theo tỷ lệ thành tiền trước khi tính.
 * Chưa có thiết lập phương pháp tính thuế (khấu trừ / trực tiếp) nên chỉ áp dụng cách 10% → 8%.
 */
public final class InvoiceTaxReduction {

    public static final LocalDate FROM = LocalDate.of(2025, 7, 1);
    public static final LocalDate TO = LocalDate.of(2026, 12, 31);
    private static final ZoneId VN = ZoneId.of("Asia/Ho_Chi_Minh");

    private InvoiceTaxReduction() {
    }

    /** Ngày bán (giờ VN) nằm trong thời gian áp dụng. */
    public static boolean inWindow(Instant at) {
        LocalDate d = (at == null ? Instant.now() : at).atZone(VN).toLocalDate();
        return !d.isBefore(FROM) && !d.isAfter(TO);
    }

    public static boolean eligible(LineInput l) {
        return Boolean.TRUE.equals(l.taxReducible()) && "VAT10".equals(l.taxCode());
    }

    /** Số tiền giảm thuế của hóa đơn (subtotal / total = trước giảm thuế). */
    static BigDecimal amount(List<LineInput> lines, BigDecimal subtotal, BigDecimal afterDiscount) {
        if (subtotal.signum() == 0) {
            return BigDecimal.ZERO;
        }
        BigDecimal eligibleGross = lines.stream().filter(InvoiceTaxReduction::eligible).map(InvoiceMath::lineAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal net = eligibleGross.multiply(afterDiscount).divide(subtotal, 6, RoundingMode.HALF_UP);
        return net.multiply(BigDecimal.valueOf(2)).divide(BigDecimal.valueOf(110), 0, RoundingMode.HALF_UP);
    }
}
