package com.vaxclinic.sales.invoice;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.sales.invoice.InvoiceDtos.LineInput;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

/**
 * Tiền hóa đơn bán (VNĐ, làm tròn đồng HALF_UP):
 *   thành tiền dòng = làm_tròn(SL × (đơn giá − giảm giá/đv));  tổng tiền hàng = Σ thành tiền dòng
 *   khách cần trả   = tổng tiền hàng − giảm giá hóa đơn (không âm) − giảm thuế (nếu áp dụng)
 */
public final class InvoiceMath {

    private InvoiceMath() {
    }

    /**
     * taxReduction: giảm thuế (Nghị quyết 204/2025/QH15) đã trừ trong total; taxMethod: DEDUCTION / DIRECT (null = không giảm);
     * reducedLines[i]: dòng i được giảm.
     */
    public record Totals(BigDecimal subtotal, BigDecimal discount, BigDecimal total, BigDecimal taxReduction, String taxMethod,
                         List<Boolean> reducedLines) {
    }

    public static BigDecimal lineAmount(LineInput l) {
        BigDecimal disc = l.discount() == null ? BigDecimal.ZERO : l.discount();
        if (disc.compareTo(l.unitPrice()) > 0) {
            throw BusinessException.badRequest("DISCOUNT_TOO_LARGE", l.productName() + ": giảm giá lớn hơn đơn giá");
        }
        return money(l.quantity().multiply(l.unitPrice().subtract(disc)));
    }

    public static Totals totals(List<LineInput> lines, BigDecimal invoiceDiscount) {
        return totals(lines, invoiceDiscount, InvoiceTaxReduction.Plan.none(lines.size()));
    }

    /** plan: dòng được giảm thuế do server xác định ({@link TaxReductionPlanner}). */
    public static Totals totals(List<LineInput> lines, BigDecimal invoiceDiscount, InvoiceTaxReduction.Plan plan) {
        BigDecimal subtotal = lines.stream().map(InvoiceMath::lineAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal disc = money(invoiceDiscount == null ? BigDecimal.ZERO : invoiceDiscount).min(subtotal);
        BigDecimal afterDiscount = subtotal.subtract(disc);
        BigDecimal reduction = InvoiceTaxReduction.amount(lines, plan, subtotal, afterDiscount);
        boolean reduced = reduction.signum() > 0;
        return new Totals(subtotal, disc, afterDiscount.subtract(reduction), reduction, reduced ? plan.method() : null,
                reduced ? plan.eligible() : InvoiceTaxReduction.Plan.none(lines.size()).eligible());
    }

    public static BigDecimal money(BigDecimal v) {
        return v.setScale(0, RoundingMode.HALF_UP);
    }
}
