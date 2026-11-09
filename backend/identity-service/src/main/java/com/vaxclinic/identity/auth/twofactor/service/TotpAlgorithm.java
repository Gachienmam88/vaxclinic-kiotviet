package com.vaxclinic.identity.auth.twofactor.service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;

/**
 * TOTP theo RFC 6238 (HMAC-SHA1, 6 chữ số, bước 30 giây) — tương thích Google Authenticator, Microsoft Authenticator...
 * Kèm mã hóa Base32 (RFC 4648, không đệm) cho khóa bí mật hiển thị / nhúng vào mã QR otpauth://.
 */
public final class TotpAlgorithm {

    public static final int STEP_SECONDS = 30;
    private static final String B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    private static final SecureRandom RANDOM = new SecureRandom();

    private TotpAlgorithm() {
    }

    /** Khóa bí mật 160 bit (độ dài khuyến nghị của RFC 4226). */
    public static byte[] newSecret() {
        byte[] b = new byte[20];
        RANDOM.nextBytes(b);
        return b;
    }

    public static long stepOf(long epochSecond) {
        return epochSecond / STEP_SECONDS;
    }

    /** Mã 6 chữ số của 1 bước thời gian. */
    public static String code(byte[] secret, long step) {
        try {
            Mac mac = Mac.getInstance("HmacSHA1");
            mac.init(new SecretKeySpec(secret, "HmacSHA1"));
            byte[] h = mac.doFinal(ByteBuffer.allocate(8).putLong(step).array());
            int off = h[h.length - 1] & 0x0f;
            int bin = ((h[off] & 0x7f) << 24) | ((h[off + 1] & 0xff) << 16) | ((h[off + 2] & 0xff) << 8) | (h[off + 3] & 0xff);
            return String.format("%06d", bin % 1_000_000);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    /**
     * Bước thời gian khớp mã trong cửa sổ ±1 bước (lệch đồng hồ ≤ 30 giây) và lớn hơn lastStep (mã đã dùng không dùng lại);
     * không khớp → -1.
     */
    public static long match(byte[] secret, String code, long nowStep, Long lastStep) {
        for (long s = nowStep - 1; s <= nowStep + 1; s++) {
            if ((lastStep == null || s > lastStep) && java.security.MessageDigest.isEqual(
                    code(secret, s).getBytes(java.nio.charset.StandardCharsets.US_ASCII),
                    code.getBytes(java.nio.charset.StandardCharsets.US_ASCII))) {
                return s;
            }
        }
        return -1;
    }

    public static String base32(byte[] data) {
        StringBuilder sb = new StringBuilder();
        int buffer = 0;
        int bits = 0;
        for (byte b : data) {
            buffer = (buffer << 8) | (b & 0xff);
            bits += 8;
            while (bits >= 5) {
                sb.append(B32.charAt((buffer >> (bits - 5)) & 31));
                bits -= 5;
            }
        }
        if (bits > 0) {
            sb.append(B32.charAt((buffer << (5 - bits)) & 31));
        }
        return sb.toString();
    }

    /** Chuỗi ngẫu nhiên Base32 chữ thường (mã khôi phục). */
    public static String randomToken(int chars) {
        StringBuilder sb = new StringBuilder(chars);
        for (int i = 0; i < chars; i++) {
            sb.append(Character.toLowerCase(B32.charAt(RANDOM.nextInt(32))));
        }
        return sb.toString();
    }
}
