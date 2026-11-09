package com.vaxclinic.sales.cashbook.service;

import java.nio.charset.StandardCharsets;
import java.text.Normalizer;

/**
 * Nội dung mã VietQR (chuẩn EMVCo QR / NAPAS 247) chuyển khoản tới 1 tài khoản, có số tiền + nội dung.
 * Mọi app ngân hàng Việt Nam quét được. Cấu trúc: các trường ID(2) + độ dài(2) + giá trị, kết thúc CRC-16/CCITT-FALSE.
 */
public final class VietQrPayload {

    private static final String NAPAS_GUID = "A000000727";
    private static final String SERVICE_TO_ACCOUNT = "QRIBFTTA";

    private VietQrPayload() {
    }

    /** @param bankBin mã BIN 6 số của ngân hàng (VD VietinBank 970415); amount 0 = để người chuyển tự nhập */
    public static String build(String bankBin, String accountNo, long amount, String purpose) {
        String beneficiary = field("00", bankBin) + field("01", accountNo);
        String merchant = field("00", NAPAS_GUID) + field("01", beneficiary) + field("02", SERVICE_TO_ACCOUNT);
        StringBuilder s = new StringBuilder()
                .append(field("00", "01"))
                .append(field("01", amount > 0 ? "12" : "11")) // 12 = mã động (có số tiền), 11 = tĩnh
                .append(field("38", merchant))
                .append(field("53", "704"))                    // VND
                .append(amount > 0 ? field("54", Long.toString(amount)) : "")
                .append(field("58", "VN"));
        String info = sanitize(purpose);
        if (!info.isEmpty()) {
            s.append(field("62", field("08", info)));
        }
        s.append("6304");
        return s + crc16(s.toString());
    }

    private static String field(String id, String value) {
        return id + "%02d".formatted(value.length()) + value;
    }

    /** Nội dung CK: bỏ dấu tiếng Việt, chỉ giữ chữ/số/khoảng trắng, tối đa 25 ký tự (giới hạn phổ biến của ngân hàng). */
    static String sanitize(String purpose) {
        if (purpose == null) {
            return "";
        }
        String s = Normalizer.normalize(purpose, Normalizer.Form.NFD).replaceAll("\\p{M}", "")
                .replace('đ', 'd').replace('Đ', 'D').replaceAll("[^A-Za-z0-9 ]", " ").replaceAll("\\s+", " ").trim();
        return s.length() > 25 ? s.substring(0, 25).trim() : s;
    }

    /** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF) — chuẩn EMVCo. */
    static String crc16(String data) {
        int crc = 0xFFFF;
        for (byte b : data.getBytes(StandardCharsets.UTF_8)) {
            crc ^= (b & 0xFF) << 8;
            for (int i = 0; i < 8; i++) {
                crc = (crc & 0x8000) != 0 ? (crc << 1) ^ 0x1021 : crc << 1;
                crc &= 0xFFFF;
            }
        }
        return "%04X".formatted(crc);
    }
}
