package com.vaxclinic.product.purchase;

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

    @Test
    void perLineVatRatesAreRoundedPerLineAndSummed() {
        // 5% trên 5,855,400 = 292,770; 10% trên 685,714 = 68,571.4 → 68,571; KCT (null) không thuế
        var t = PurchaseMath.totals(List.of(new PurchaseMath.LineAmount(line("30", "195180"), bd("5")),
                new PurchaseMath.LineAmount(line("10", "68571.4"), bd("10")),
                new PurchaseMath.LineAmount(line("1", "1000"), null)), BigDecimal.ZERO, false, null);
        assertThat(t.vatAmount()).isEqualByComparingTo("361341");
        assertThat(t.total()).isEqualByComparingTo(t.subtotal().add(bd("361341")));
    }

    @Test
    void returnOfOneDoseAt5PercentMatchesKiotVietScreenshot() {
        // Trả 1 × 195,180, VAT 5% → VAT hoàn lại 9,759; NCC cần trả 204,939
        var t = PurchaseMath.totals(List.of(new PurchaseMath.LineAmount(line("1", "195180"), bd("5"))), BigDecimal.ZERO, false, null);
        assertThat(t.vatAmount()).isEqualByComparingTo("9759");
        assertThat(t.total()).isEqualByComparingTo("204939");
    }

    @Test
    void manualVatIsSpreadProportionallyIntoCost() {
        // 2 dòng 1,000,000 + 3,000,000, VAT nhập tay 200,000 (= 5% tiền hàng) → giá vốn mỗi dòng × 1.05
        var t = PurchaseMath.totals(List.of(new PurchaseMath.LineAmount(line("1", "1000000"), null),
                new PurchaseMath.LineAmount(line("1", "3000000"), null)), BigDecimal.ZERO, true, bd("200000"));
        assertThat(t.vatAmount()).isEqualByComparingTo("200000");
        BigDecimal ratio = PurchaseMath.vatRatio(PurchaseMath.MODE_MANUAL, null, t);
        assertThat(PurchaseMath.baseUnitCostWithRatio(bd("1000000"), BigDecimal.ZERO, BigDecimal.ONE, t, ratio))
                .isEqualByComparingTo("1050000");
    }

    @Test
    void legacyRequestWithoutModeUsesHeaderRateForEveryLine() {
        assertThat(PurchaseMath.lineRate(null, bd("5"), bd("10"))).isEqualByComparingTo("5");
        assertThat(PurchaseMath.lineRate("LINE", bd("5"), bd("10"))).isEqualByComparingTo("10");
        assertThat(PurchaseMath.lineRate("MANUAL", bd("5"), bd("10"))).isNull();
        assertThat(PurchaseMath.commonRate("LINE", List.of(bd("5"), bd("5.00")), null)).isEqualByComparingTo("5");
        assertThat(PurchaseMath.commonRate("LINE", List.of(bd("5"), bd("10")), null)).isNull();
    }

    @Test
    void returnFromManualVatReceiptDefaultsToNearestStandardRate() {
        // VAT tay 470,000 trên (10,000,000 − 0) = 4.7% → 5%; 700,000 = 7% → 8%; 0 → KCT; phiếu theo dòng → VAT% của dòng
        assertThat(PurchaseMath.defaultReturnVatRate("MANUAL", null, bd("10000000"), BigDecimal.ZERO, bd("470000"))).isEqualByComparingTo("5");
        assertThat(PurchaseMath.defaultReturnVatRate("MANUAL", null, bd("10000000"), bd("0"), bd("700000"))).isEqualByComparingTo("8");
        assertThat(PurchaseMath.defaultReturnVatRate("MANUAL", null, bd("10000000"), BigDecimal.ZERO, BigDecimal.ZERO)).isNull();
        assertThat(PurchaseMath.defaultReturnVatRate("LINE", bd("10"), bd("10000000"), BigDecimal.ZERO, bd("1"))).isEqualByComparingTo("10");
    }
}
