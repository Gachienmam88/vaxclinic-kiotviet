package com.vaxclinic.integration.einvoice.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class VietnameseAmountInWordsTest {

    @Test
    void matchesCustomerEInvoicePreview() {
        // Ảnh "Xem trước hóa đơn điện tử" HD015313: 390.000 → "Ba trăm chín mươi nghìn đồng chẵn."
        assertThat(VietnameseAmountInWords.of(390_000)).isEqualTo("Ba trăm chín mươi nghìn đồng chẵn.");
    }

    @Test
    void handlesVietnameseReadingRules() {
        assertThat(VietnameseAmountInWords.of(9_463_452))
                .isEqualTo("Chín triệu bốn trăm sáu mươi ba nghìn bốn trăm năm mươi hai đồng chẵn.");
        assertThat(VietnameseAmountInWords.of(1_005_000)).isEqualTo("Một triệu không trăm lẻ năm nghìn đồng chẵn.");
        assertThat(VietnameseAmountInWords.of(21_000)).isEqualTo("Hai mươi mốt nghìn đồng chẵn.");
        assertThat(VietnameseAmountInWords.of(15_000)).isEqualTo("Mười lăm nghìn đồng chẵn.");
        assertThat(VietnameseAmountInWords.of(24_000)).isEqualTo("Hai mươi tư nghìn đồng chẵn.");
        assertThat(VietnameseAmountInWords.of(1_000_000_000)).isEqualTo("Một tỷ đồng chẵn.");
        assertThat(VietnameseAmountInWords.of(105)).isEqualTo("Một trăm lẻ năm đồng chẵn.");
    }
}
