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
                new BigDecimal(price), discount == null ? null : new BigDecimal(discount), null);
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
