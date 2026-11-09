package com.vaxclinic.product.purchase.service;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** Kiểm công thức tiền phiếu nhập bằng số liệu phiếu PN000103 thực tế của khách hàng (VAT 5%). */
class PurchaseMathTest {

    private static BigDecimal bd(String v) {
        return new BigDecimal(v);
    }

    private static BigDecimal line(String qty, String price) {
        return PurchaseMath.lineAmount(bd(qty), bd(price), BigDecimal.ZERO);
    }

    @Test
    void totalsMatchRealReceiptPN000103ToTheDong() {
        // 4 dòng × 10 liều: 685,714 / 166,667 / 33,297 / 15,603 — số trên phiếu: VAT 450,642, tổng 9,463,452
        var lines = List.of(line("10", "685714"), line("10", "166667"), line("10", "33297"), line("10", "15603"));

        var t = PurchaseMath.totals(lines, BigDecimal.ZERO, bd("5"));

        assertThat(t.subtotal()).isEqualByComparingTo("9012810");
        assertThat(t.vatAmount()).isEqualByComparingTo("450642"); // VAT làm tròn từng dòng rồi cộng
        assertThat(t.total()).isEqualByComparingTo("9463452");
    }

    @Test
    void baseUnitCostIncludesVatLikeShingrixExample() {
        // Ảnh chi tiết Shingrix: đơn giá 3,132,115.24, VAT 5% → giá vốn hiển thị 3,288,721.0
        var t = PurchaseMath.totals(List.of(line("10", "3132115.24")), BigDecimal.ZERO, bd("5"));
        BigDecimal cost = PurchaseMath.baseUnitCost(bd("3132115.24"), BigDecimal.ZERO, BigDecimal.ONE, t, bd("5"));
        assertThat(cost).isEqualByComparingTo("3288721.0020");
    }

    @Test
    void receiptDiscountIsAllocatedProportionallyAndUnitConverted() {
        // 2 hộp × 1,000,000 (1 hộp = 10 liều), giảm giá phiếu 200,000 (10%), không VAT
        var t = PurchaseMath.totals(List.of(line("2", "1000000")), bd("200000"), null);
        assertThat(t.total()).isEqualByComparingTo("1800000");
        BigDecimal costPerDose = PurchaseMath.baseUnitCost(bd("1000000"), BigDecimal.ZERO, bd("10"), t, null);
        assertThat(costPerDose).isEqualByComparingTo("90000"); // 1,000,000 × 90% / 10 liều
    }

    @Test
    void vatIsComputedAfterReceiptDiscount() {
        // 1,000,000 giảm 100,000 → chịu VAT 900,000 × 5% = 45,000
        var t = PurchaseMath.totals(List.of(line("1", "1000000")), bd("100000"), bd("5"));
        assertThat(t.vatAmount()).isEqualByComparingTo("45000");
        assertThat(t.total()).isEqualByComparingTo("945000");
    }

    @Test
    void receiptDiscountCannotExceedSubtotal() {
        var t = PurchaseMath.totals(List.of(line("1", "100000")), bd("500000"), bd("5"));
        assertThat(t.discount()).isEqualByComparingTo("100000");
        assertThat(t.total()).isEqualByComparingTo("0");
    }
}
