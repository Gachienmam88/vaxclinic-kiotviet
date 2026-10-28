package com.vaxclinic.sales.invoice;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.sales.invoice.InvoiceDtos.LineInput;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

/**
 * Tiền hóa đơn bán (VNĐ, làm tròn đồng HALF_UP):
 *   thành tiền dòng = làm_tròn(SL × (đơn giá − giảm giá/đv));  tổng tiền hàng = Σ thành tiền dòng
 *   khách cần trả   = tổng tiền hàng − giảm giá hóa đơn (không âm)
 */
public final class InvoiceMath {

    private InvoiceMath() {
    }

    public record Totals(BigDecimal subtotal, BigDecimal discount, BigDecimal total) {
    }

    public static BigDecimal lineAmount(LineInput l) {
        BigDecimal disc = l.discount() == null ? BigDecimal.ZERO : l.discount();
        if (disc.compareTo(l.unitPrice()) > 0) {
            throw BusinessException.badRequest("DISCOUNT_TOO_LARGE", l.productName() + ": giảm giá lớn hơn đơn giá");
        }
        return money(l.quantity().multiply(l.unitPrice().subtract(disc)));
    }

    public static Totals totals(List<LineInput> lines, BigDecimal invoiceDiscount) {
        BigDecimal subtotal = lines.stream().map(InvoiceMath::lineAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal disc = money(invoiceDiscount == null ? BigDecimal.ZERO : invoiceDiscount).min(subtotal);
        return new Totals(subtotal, disc, subtotal.subtract(disc));
    }

    public static BigDecimal money(BigDecimal v) {
        return v.setScale(0, RoundingMode.HALF_UP);
    }
}
