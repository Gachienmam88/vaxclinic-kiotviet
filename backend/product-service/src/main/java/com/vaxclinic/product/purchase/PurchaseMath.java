package com.vaxclinic.product.purchase;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Objects;

/**
 * Công thức tiền của chứng từ mua hàng (VNĐ, làm tròn đồng HALF_UP):
 * <pre>
 *   thành tiền dòng = SL × (đơn giá − giảm giá/đv)
 *   tổng tiền hàng  = Σ thành tiền dòng
 *   VAT (chế độ LINE)   = Σ làm_tròn((thành tiền dòng − phần giảm giá phiếu phân bổ cho dòng) × VAT% của DÒNG)
 *                         (làm tròn TỪNG DÒNG rồi cộng — khớp số liệu hóa đơn thực tế, VD phiếu PN000103 = 450,642)
 *   VAT (chế độ MANUAL) = số người dùng nhập (làm tròn đồng)
 *   tổng cộng       = tổng tiền hàng − giảm giá phiếu + VAT        (= cần trả NCC)
 * </pre>
 * Giá vốn / 1 đơn vị cơ bản của 1 dòng (giá đã gồm VAT vì đơn vị không khấu trừ VAT đầu vào):
 * <pre>
 *   (đơn giá − giảm giá/đv) × (1 − giảm giá phiếu / tổng tiền hàng) × (1 + tỷ lệ VAT) / quy đổi
 *   tỷ lệ VAT: LINE = VAT% của dòng / 100; MANUAL = VAT nhập tay / (tổng tiền hàng − giảm giá phiếu) (chia đều theo tiền)
 * </pre>
 */
public final class PurchaseMath {

    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    public static final String MODE_LINE = "LINE";
    public static final String MODE_MANUAL = "MANUAL";

    private PurchaseMath() {
    }

    public record Totals(BigDecimal subtotal, BigDecimal discount, BigDecimal vatAmount, BigDecimal total) {
    }

    /** Thành tiền 1 dòng (chưa làm tròn) + VAT% của dòng (null = không chịu thuế / KCT). */
    public record LineAmount(BigDecimal amount, BigDecimal vatRate) {
    }

    public static BigDecimal lineAmount(BigDecimal qty, BigDecimal unitPrice, BigDecimal unitDiscount) {
        return qty.multiply(unitPrice.subtract(unitDiscount));
    }

    /** 1 mức VAT cho mọi dòng (phiếu cũ / trả hàng nhập kiểu cũ). @param lineAmounts thành tiền từng dòng (chưa làm tròn) */
    public static Totals totals(List<BigDecimal> lineAmounts, BigDecimal discount, BigDecimal vatRate) {
        return totals(lineAmounts.stream().map(a -> new LineAmount(a, vatRate)).toList(), discount, false, null);
    }

    /** manual = true: VAT = manualVat (nhập tay); false: VAT theo từng dòng. */
    public static Totals totals(List<LineAmount> lines, BigDecimal discount, boolean manual, BigDecimal manualVat) {
        BigDecimal raw = lines.stream().map(LineAmount::amount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal subtotal = money(raw);
        BigDecimal disc = money(discount.min(subtotal).max(BigDecimal.ZERO));
        BigDecimal vat = BigDecimal.ZERO;
        if (manual) {
            vat = manualVat == null ? BigDecimal.ZERO : money(manualVat.max(BigDecimal.ZERO));
        } else if (raw.signum() > 0) {
            BigDecimal keepRatio = BigDecimal.ONE.subtract(disc.divide(raw, 10, RoundingMode.HALF_UP));
            for (LineAmount l : lines) {
                if (l.vatRate() != null) {
                    vat = vat.add(money(l.amount().multiply(keepRatio).multiply(l.vatRate()).divide(HUNDRED, 6, RoundingMode.HALF_UP)));
                }
            }
        }
        return new Totals(subtotal, disc, vat, subtotal.subtract(disc).add(vat));
    }

    /** Tỷ lệ VAT cộng vào giá vốn / giá có VAT của 1 dòng (xem đầu lớp). */
    public static BigDecimal vatRatio(String vatMode, BigDecimal lineVatRate, Totals t) {
        if (MODE_MANUAL.equals(vatMode)) {
            BigDecimal base = t.subtotal().subtract(t.discount());
            return base.signum() > 0 ? t.vatAmount().divide(base, 10, RoundingMode.HALF_UP) : BigDecimal.ZERO;
        }
        return lineVatRate == null ? BigDecimal.ZERO : lineVatRate.divide(HUNDRED, 6, RoundingMode.HALF_UP);
    }

    /** Giá vốn / đơn vị cơ bản (4 số lẻ) phân bổ giảm giá phiếu và VAT (1 mức) vào từng dòng. */
    public static BigDecimal baseUnitCost(BigDecimal unitPrice, BigDecimal unitDiscount, BigDecimal conversionRate,
                                          Totals totals, BigDecimal vatRate) {
        return baseUnitCostWithRatio(unitPrice, unitDiscount, conversionRate, totals,
                vatRate == null ? BigDecimal.ZERO : vatRate.divide(HUNDRED, 6, RoundingMode.HALF_UP));
    }

    /** Như {@link #baseUnitCost} nhưng với tỷ lệ VAT đã tính sẵn ({@link #vatRatio}). */
    public static BigDecimal baseUnitCostWithRatio(BigDecimal unitPrice, BigDecimal unitDiscount, BigDecimal conversionRate,
                                                   Totals totals, BigDecimal vatRatio) {
        BigDecimal net = unitPrice.subtract(unitDiscount);
        if (totals.subtotal().signum() > 0 && totals.discount().signum() > 0) {
            BigDecimal keepRatio = BigDecimal.ONE.subtract(totals.discount().divide(totals.subtotal(), 10, RoundingMode.HALF_UP));
            net = net.multiply(keepRatio);
        }
        if (vatRatio.signum() != 0) {
            net = net.multiply(BigDecimal.ONE.add(vatRatio));
        }
        return net.divide(conversionRate, 4, RoundingMode.HALF_UP);
    }

    /** Giá nhập (trả) có VAT / 1 đơn vị của dòng, 2 số lẻ — cột "Giá nhập có VAT" (không phân bổ giảm giá phiếu). */
    public static BigDecimal priceWithVat(BigDecimal unitPrice, BigDecimal unitDiscount, BigDecimal vatRatio) {
        BigDecimal net = unitPrice.subtract(unitDiscount);
        return vatRatio.signum() == 0 ? net : net.multiply(BigDecimal.ONE.add(vatRatio)).setScale(2, RoundingMode.HALF_UP);
    }

    private static final List<BigDecimal> STANDARD_RATES = List.of(BigDecimal.ZERO, BigDecimal.valueOf(5), BigDecimal.valueOf(8),
            BigDecimal.TEN);

    /**
     * VAT% mặc định của dòng trả hàng theo phiếu nhập: phiếu VAT theo dòng → VAT% của dòng nhập; phiếu VAT nhập tay →
     * mức gần nhất trong 0 / 5 / 8 / 10% với VAT phiếu / (tổng tiền hàng − giảm giá) (bằng nhau thì lấy mức thấp hơn);
     * phiếu nhập tay không có VAT → null (KCT).
     */
    public static BigDecimal defaultReturnVatRate(String vatMode, BigDecimal lineRate, BigDecimal subtotal, BigDecimal discount,
                                                  BigDecimal vatAmount) {
        if (!MODE_MANUAL.equals(vatMode)) {
            return lineRate;
        }
        BigDecimal base = subtotal.subtract(discount);
        if (vatAmount.signum() <= 0 || base.signum() <= 0) {
            return null;
        }
        BigDecimal pct = vatAmount.multiply(HUNDRED).divide(base, 6, RoundingMode.HALF_UP);
        BigDecimal best = STANDARD_RATES.get(0);
        for (BigDecimal r : STANDARD_RATES) {
            if (r.subtract(pct).abs().compareTo(best.subtract(pct).abs()) < 0) {
                best = r;
            }
        }
        return best;
    }

    /** "LINE" | "MANUAL"; null / khác → LINE. */
    public static String mode(String vatMode) {
        return MODE_MANUAL.equals(vatMode) ? MODE_MANUAL : MODE_LINE;
    }

    /**
     * VAT% của 1 dòng theo request: client cũ (không gửi vatMode) dùng 1 mức của phiếu cho mọi dòng; client mới gửi
     * VAT% từng dòng (null = KCT). Chế độ MANUAL: dòng không mang VAT% (VAT của phiếu nhập tay).
     */
    public static BigDecimal lineRate(String requestMode, BigDecimal headerRate, BigDecimal lineRate) {
        if (requestMode == null) {
            return headerRate;
        }
        return MODE_MANUAL.equals(requestMode) ? null : lineRate;
    }

    /** Mức VAT chung của phiếu (cột vat_rate): mọi dòng cùng 1 mức → mức đó; lẫn mức / MANUAL → null. */
    public static BigDecimal commonRate(String vatMode, List<BigDecimal> rates, BigDecimal fallback) {
        if (MODE_MANUAL.equals(vatMode)) {
            return null;
        }
        if (rates.isEmpty()) {
            return fallback;
        }
        BigDecimal first = rates.get(0);
        return rates.stream().allMatch(r -> r == null ? first == null : first != null && r.compareTo(first) == 0) ? first : null;
    }

    public static BigDecimal money(BigDecimal v) {
        return v.setScale(0, RoundingMode.HALF_UP);
    }

    static boolean same(BigDecimal a, BigDecimal b) {
        return Objects.equals(a == null ? null : a.stripTrailingZeros(), b == null ? null : b.stripTrailingZeros());
    }
}
