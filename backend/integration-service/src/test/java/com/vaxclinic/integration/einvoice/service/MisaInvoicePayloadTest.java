package com.vaxclinic.integration.einvoice.service;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SuppressWarnings("unchecked")
class MisaInvoicePayloadTest {

    private static MisaInvoicePayload.SourceLine line(String price, String tax) {
        return new MisaInvoicePayload.SourceLine("SP1", "Vắc xin", "Liều", BigDecimal.ONE, new BigDecimal(price), BigDecimal.ZERO, tax);
    }

    private static Map<String, Object> inv(Map<String, Object> item) {
        return (Map<String, Object>) item.get("OrgInvoiceData");
    }

    @Test
    void hd015313HouseholdBusinessNoVat() {
        // Hóa đơn thật HD015313: Morcvax 120,000 + Typhim Vi 270,000, KCT → tổng 390,000, thuế 0
        var src = new MisaInvoicePayload.Source("HD015313", Instant.parse("2026-10-28T03:51:00Z"), "CASH", BigDecimal.ZERO,
                new BigDecimal("390000"), "104092920240078", "Ngô Minh Khải", null, null, "thôn Đại Tự 1, Xã Liên Châu, tỉnh Phú Thọ",
                null, "0977237130", List.of(line("120000", "HKD_KCT_15"), line("270000", "HKD_KCT_15")));
        var item = MisaInvoicePayload.build(src, UUID.randomUUID(), "2C26MAA", "Hóa đơn bán hàng", false);
        var inv = inv(item);
        assertThat(inv.get("IsInvoiceCalculatingMachine")).isEqualTo(true);
        assertThat(inv.get("InvDate")).isEqualTo("2026-10-28");
        assertThat((BigDecimal) inv.get("TotalAmount")).isEqualByComparingTo("390000");
        assertThat((BigDecimal) inv.get("TotalVATAmount")).isEqualByComparingTo("0");
        assertThat(inv.get("TotalAmountInWords")).isEqualTo("Ba trăm chín mươi nghìn đồng chẵn.");
        assertThat(inv.get("PaymentMethodName")).isEqualTo("Tiền mặt");
        var details = (List<Map<String, Object>>) inv.get("OriginalInvoiceDetail");
        assertThat(details).extracting(d -> d.get("VATRateName")).containsOnly("KCT");
        assertThat(item.get("IsSendEmail")).isEqualTo(false);
    }

    @Test
    void vatIsBackedOutOfInclusivePriceAndInvoiceDiscountSumsExactly() {
        // 2 dòng VAT 5%: 1,050,000 + 525,000; giảm HĐ 100,001 → khách trả 1,474,999
        var src = new MisaInvoicePayload.Source("HD1", Instant.now(), "TRANSFER", new BigDecimal("100001"), new BigDecimal("1474999"),
                null, "Khách lẻ", null, null, null, null, null, List.of(line("1050000", "VAT5"), line("525000", "VAT5")));
        var inv = inv(MisaInvoicePayload.build(src, UUID.randomUUID(), "2C26MAA", "Hóa đơn giá trị gia tăng", true));
        var details = (List<Map<String, Object>>) inv.get("OriginalInvoiceDetail");
        BigDecimal sumAfterTax = details.stream().map(d -> (BigDecimal) d.get("AmountAfterTax")).reduce(BigDecimal.ZERO, BigDecimal::add);
        assertThat(sumAfterTax).isEqualByComparingTo("1474999"); // giảm giá phân bổ không lệch 1 đồng
        BigDecimal without = (BigDecimal) inv.get("TotalAmountWithoutVAT");
        BigDecimal vat = (BigDecimal) inv.get("TotalVATAmount");
        assertThat(without.add(vat)).isEqualByComparingTo("1474999");
        assertThat(vat).isEqualByComparingTo("70238"); // ≈ 1,474,999 × 5/105
    }
}
