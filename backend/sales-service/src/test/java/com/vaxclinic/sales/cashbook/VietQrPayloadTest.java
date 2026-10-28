package com.vaxclinic.sales.cashbook;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class VietQrPayloadTest {

    @Test
    void crcMatchesStandardCheckValue() {
        // Giá trị kiểm tra chuẩn của CRC-16/CCITT-FALSE cho chuỗi "123456789" là 0x29B1
        assertThat(VietQrPayload.crc16("123456789")).isEqualTo("29B1");
    }

    @Test
    void buildsDynamicQrForCustomerVietinBankAccount() {
        // Tài khoản trong ảnh của khách: VietinBank 88875668, thu 390,000 cho HD015313
        String p = VietQrPayload.build("970415", "88875668", 390_000, "Thanh toán HD015313");
        assertThat(p).startsWith("000201010212");
        assertThat(p).contains("0010A000000727");
        assertThat(p).contains("0006970415" + "010888875668");
        assertThat(p).contains("0208QRIBFTTA");
        assertThat(p).contains("5303704" + "5406390000" + "5802VN");
        assertThat(p).contains("0819Thanh toan HD015313"); // bỏ dấu tiếng Việt, 19 ký tự
        // CRC ở cuối phải khớp phần còn lại
        assertThat(p.substring(p.length() - 4)).isEqualTo(VietQrPayload.crc16(p.substring(0, p.length() - 4)));
    }

    @Test
    void staticQrWithoutAmount() {
        String p = VietQrPayload.build("970415", "88875668", 0, null);
        assertThat(p).startsWith("000201010211").doesNotContain("5406");
    }

    @Test
    void sanitizeStripsAccentsAndLimitsLength() {
        assertThat(VietQrPayload.sanitize("Đỗ Gia Bách trả nợ tháng 10/2026 đợt 1"))
                .isEqualTo("Do Gia Bach tra no thang");
    }
}
