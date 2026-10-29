package com.vaxclinic.sales.invoice;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.sales.invoice.InvoiceDtos.LineInput;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Số liệu theo hóa đơn HD015313 thực tế của khách: Morcvax 120,000 + Typhim Vi 270,000 = 390,000. */
class InvoiceMathTest {

    private static LineInput line(String qty, String price, String discount) {
        return new LineInput(UUID.randomUUID(), UUID.randomUUID(), "SP", "Vắc xin", "Liều", new BigDecimal(qty),
                new BigDecimal(price), discount == null ? null : new BigDecimal(discount), null, "KCT", null);
    }

    private static LineInput taxed(String price, String taxCode, boolean reducible) {
        return new LineInput(UUID.randomUUID(), UUID.randomUUID(), "SP", "Thuốc", "Hộp", BigDecimal.ONE,
                new BigDecimal(price), null, null, taxCode, reducible);
    }

    private static InvoiceTaxReduction.Plan deduction(Boolean... eligible) {
        return new InvoiceTaxReduction.Plan("DEDUCTION", List.of(eligible), java.util.Collections.nCopies(eligible.length, null));
    }

    @Test
    void deductionReducesOnlyPlannedLines() {
        // 110.000 gồm 10% → 108.000 gồm 8% (giảm 2.000); dòng không được kế hoạch giảm giữ nguyên
        var t = InvoiceMath.totals(List.of(taxed("110000", "VAT10", true), taxed("105000", "VAT5", true),
                taxed("110000", "VAT10", true)), BigDecimal.ZERO, deduction(true, false, false));
        org.assertj.core.api.Assertions.assertThat(t.taxReduction()).isEqualByComparingTo("2000");
        org.assertj.core.api.Assertions.assertThat(t.total()).isEqualByComparingTo("323000");
        org.assertj.core.api.Assertions.assertThat(t.reducedLines()).containsExactly(true, false, false);
        org.assertj.core.api.Assertions.assertThat(t.taxMethod()).isEqualTo("DEDUCTION");
    }

    @Test
    void deductionAfterInvoiceDiscountAndNonePlan() {
        var lines = List.of(taxed("220000", "VAT10", true));
        org.assertj.core.api.Assertions.assertThat(InvoiceMath.totals(lines, new BigDecimal("110000"), deduction(true)).taxReduction())
                .isEqualByComparingTo("2000");
        var none = InvoiceMath.totals(lines, BigDecimal.ZERO);
        org.assertj.core.api.Assertions.assertThat(none.taxReduction()).isEqualByComparingTo("0");
        org.assertj.core.api.Assertions.assertThat(none.taxMethod()).isNull();
    }

    @Test
    void directMethodIsTwentyPercentOfSectorRate() {
        // 1.000.000 doanh thu, ngành 1% → giảm 1.000.000 × 1% × 20% = 2.000; dòng không đủ điều kiện không giảm
        var plan = new InvoiceTaxReduction.Plan("DIRECT", List.of(true, false), java.util.Arrays.asList(BigDecimal.ONE, null));
        var t = InvoiceMath.totals(List.of(taxed("1000000", "HKD_KCT_15", false), taxed("500000", "HKD_KCT_15", false)),
                BigDecimal.ZERO, plan);
        org.assertj.core.api.Assertions.assertThat(t.taxReduction()).isEqualByComparingTo("2000");
        org.assertj.core.api.Assertions.assertThat(t.total()).isEqualByComparingTo("1498000");
        org.assertj.core.api.Assertions.assertThat(t.taxMethod()).isEqualTo("DIRECT");
    }

    @Test
    void taxReductionWindow() {
        org.assertj.core.api.Assertions.assertThat(InvoiceTaxReduction.inWindow(java.time.Instant.parse("2025-06-30T16:59:59Z"))).isFalse();
        org.assertj.core.api.Assertions.assertThat(InvoiceTaxReduction.inWindow(java.time.Instant.parse("2025-06-30T17:00:00Z"))).isTrue();
        org.assertj.core.api.Assertions.assertThat(InvoiceTaxReduction.inWindow(java.time.Instant.parse("2026-12-31T16:59:59Z"))).isTrue();
        org.assertj.core.api.Assertions.assertThat(InvoiceTaxReduction.inWindow(java.time.Instant.parse("2026-12-31T17:00:00Z"))).isFalse();
    }

    @Test
    void totalsMatchRealInvoiceHD015313() {
        var t = InvoiceMath.totals(List.of(line("1", "120000", null), line("1", "270000", null)), BigDecimal.ZERO);
        assertThat(t.subtotal()).isEqualByComparingTo("390000");
        assertThat(t.total()).isEqualByComparingTo("390000");
    }

    @Test
    void lineAndInvoiceDiscountsApply() {
        // 2 liều × (500,000 − 50,000) = 900,000; giảm HĐ 100,000 → 800,000
        var t = InvoiceMath.totals(List.of(line("2", "500000", "50000")), new BigDecimal("100000"));
        assertThat(t.subtotal()).isEqualByComparingTo("900000");
        assertThat(t.total()).isEqualByComparingTo("800000");
    }

    @Test
    void invoiceDiscountNeverMakesTotalNegative() {
        var t = InvoiceMath.totals(List.of(line("1", "100000", null)), new BigDecimal("999999"));
        assertThat(t.discount()).isEqualByComparingTo("100000");
        assertThat(t.total()).isEqualByComparingTo("0");
    }

    @Test
    void lineDiscountGreaterThanPriceIsRejected() {
        assertThatThrownBy(() -> InvoiceMath.totals(List.of(line("1", "100000", "150000")), BigDecimal.ZERO))
                .isInstanceOf(BusinessException.class);
    }
}
