package com.vaxclinic.product.purchase;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Công thức tiền của chứng từ mua hàng (VNĐ, làm tròn đồng HALF_UP):
 * <pre>
 *   thành tiền dòng = SL × (đơn giá − giảm giá/đv)
 *   tổng tiền hàng  = Σ thành tiền dòng
 *   VAT             = (tổng tiền hàng − giảm giá phiếu) × VAT%
 *   tổng cộng       = tổng tiền hàng − giảm giá phiếu + VAT        (= cần trả NCC)
 * </pre>
 * Giá vốn / 1 đơn vị cơ bản của 1 dòng (giá đã gồm VAT vì đơn vị không khấu trừ VAT đầu vào):
 * <pre>
 *   (đơn giá − giảm giá/đv) × (1 − giảm giá phiếu / tổng tiền hàng) × (1 + VAT%) / quy đổi
 * </pre>
 */
public final class PurchaseMath {

    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    private PurchaseMath() {
    }

    public record Totals(BigDecimal subtotal, BigDecimal discount, BigDecimal vatAmount, BigDecimal total) {
    }

    public static BigDecimal lineAmount(BigDecimal qty, BigDecimal unitPrice, BigDecimal unitDiscount) {
        return qty.multiply(unitPrice.subtract(unitDiscount));
    }

    public static Totals totals(BigDecimal rawSubtotal, BigDecimal discount, BigDecimal vatRate) {
        BigDecimal subtotal = money(rawSubtotal);
        BigDecimal disc = money(discount.min(subtotal));
        BigDecimal vat = vatRate == null ? BigDecimal.ZERO
                : money(subtotal.subtract(disc).multiply(vatRate).divide(HUNDRED, 6, RoundingMode.HALF_UP));
        return new Totals(subtotal, disc, vat, subtotal.subtract(disc).add(vat));
    }

    /** Giá vốn / đơn vị cơ bản (4 số lẻ) phân bổ giảm giá phiếu và VAT vào từng dòng. */
    public static BigDecimal baseUnitCost(BigDecimal unitPrice, BigDecimal unitDiscount, BigDecimal conversionRate,
                                          Totals totals, BigDecimal vatRate) {
        BigDecimal net = unitPrice.subtract(unitDiscount);
        if (totals.subtotal().signum() > 0 && totals.discount().signum() > 0) {
            BigDecimal keepRatio = BigDecimal.ONE.subtract(totals.discount().divide(totals.subtotal(), 10, RoundingMode.HALF_UP));
            net = net.multiply(keepRatio);
        }
        if (vatRate != null) {
            net = net.multiply(BigDecimal.ONE.add(vatRate.divide(HUNDRED, 6, RoundingMode.HALF_UP)));
        }
        return net.divide(conversionRate, 4, RoundingMode.HALF_UP);
    }

    public static BigDecimal money(BigDecimal v) {
        return v.setScale(0, RoundingMode.HALF_UP);
    }
}
