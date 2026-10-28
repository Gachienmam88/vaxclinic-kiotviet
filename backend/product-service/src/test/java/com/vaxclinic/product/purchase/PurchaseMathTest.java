package com.vaxclinic.product.purchase;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

/** Kiểm công thức tiền phiếu nhập bằng số liệu phiếu PN000103 thực tế của khách hàng (VAT 5%). */
class PurchaseMathTest {

    private static BigDecimal bd(String v) {
        return new BigDecimal(v);
    }

    @Test
    void totalsMatchRealReceiptPN000103() {
        // 4 dòng × 10 liều: 685,714 / 166,667 / 33,297 / 15,603
        BigDecimal raw = PurchaseMath.lineAmount(bd("10"), bd("685714"), BigDecimal.ZERO)
                .add(PurchaseMath.lineAmount(bd("10"), bd("166667"), BigDecimal.ZERO))
                .add(PurchaseMath.lineAmount(bd("10"), bd("33297"), BigDecimal.ZERO))
                .add(PurchaseMath.lineAmount(bd("10"), bd("15603"), BigDecimal.ZERO));

        var t = PurchaseMath.totals(raw, BigDecimal.ZERO, bd("5"));

        assertThat(t.subtotal()).isEqualByComparingTo("9012810");
        assertThat(t.vatAmount()).isEqualByComparingTo("450641"); // 450,640.5 → làm tròn HALF_UP = 450,641
        assertThat(t.total()).isEqualByComparingTo("9463451");
    }

    @Test
    void baseUnitCostIncludesVatLikeShingrixExample() {
        // Ảnh chi tiết Shingrix: đơn giá 3,132,115.24, VAT 5% → giá vốn 3,288,721.0 (đơn vị Hộp quy đổi 1)
        var t = PurchaseMath.totals(bd("31321152.4"), BigDecimal.ZERO, bd("5"));
        BigDecimal cost = PurchaseMath.baseUnitCost(bd("3132115.24"), BigDecimal.ZERO, BigDecimal.ONE, t, bd("5"));
        assertThat(cost).isEqualByComparingTo("3288721.0020");
    }

    @Test
    void receiptDiscountIsAllocatedProportionallyAndUnitConverted() {
        // 2 hộp × 1,000,000 (1 hộp = 10 liều), giảm giá phiếu 200,000 (10%), không VAT
        var t = PurchaseMath.totals(bd("2000000"), bd("200000"), null);
        assertThat(t.total()).isEqualByComparingTo("1800000");
        BigDecimal costPerDose = PurchaseMath.baseUnitCost(bd("1000000"), BigDecimal.ZERO, bd("10"), t, null);
        assertThat(costPerDose).isEqualByComparingTo("90000"); // 1,000,000 × 90% / 10 liều
    }

    @Test
    void receiptDiscountCannotExceedSubtotal() {
        var t = PurchaseMath.totals(bd("100000"), bd("500000"), bd("5"));
        assertThat(t.discount()).isEqualByComparingTo("100000");
        assertThat(t.total()).isEqualByComparingTo("0");
    }
}
