package com.vaxclinic.identity.auth.twofactor;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;

/**
 * Mã hóa khóa TOTP khi lưu DB (AES-256-GCM, định dạng base64(iv[12] || ciphertext+tag)) và băm mã khôi phục (HMAC-SHA256).
 * Hai khóa dẫn xuất bằng HMAC từ ENCRYPTION_KEY (thiếu thì JWT secret) với nhãn riêng — cùng cách ClockTokenService
 * dẫn xuất khóa QR chấm công; khóa không lưu DB, không gửi ra trình duyệt. Đổi ENCRYPTION_KEY → mọi user phải bật lại 2FA.
 */
@Component
public class TotpSecretCipher {

    private static final int IV_LEN = 12;
    private final SecretKeySpec aesKey;
    private final byte[] recoveryPepper;
    private final SecureRandom random = new SecureRandom();

    public TotpSecretCipher(@Value("${app.totp.secret:}") String secret, @Value("${app.jwt.secret}") String jwtSecret) {
        byte[] base = (secret == null || secret.isBlank() ? jwtSecret : secret).getBytes(StandardCharsets.UTF_8);
        this.aesKey = new SecretKeySpec(hmac(base, "vaxclinic-identity-totp-aes-v1"), "AES");
        this.recoveryPepper = hmac(base, "vaxclinic-identity-recovery-v1");
    }

    public String encrypt(byte[] plain) {
        try {
            byte[] iv = new byte[IV_LEN];
            random.nextBytes(iv);
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.ENCRYPT_MODE, aesKey, new GCMParameterSpec(128, iv));
            byte[] ct = c.doFinal(plain);
            return Base64.getEncoder().encodeToString(ByteBuffer.allocate(IV_LEN + ct.length).put(iv).put(ct).array());
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Encrypt failed", e);
        }
    }

    public byte[] decrypt(String stored) {
        try {
            byte[] all = Base64.getDecoder().decode(stored);
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.DECRYPT_MODE, aesKey, new GCMParameterSpec(128, all, 0, IV_LEN));
            return c.doFinal(all, IV_LEN, all.length - IV_LEN);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Decrypt failed (ENCRYPTION_KEY changed?)", e);
        }
    }

    /** HMAC của mã khôi phục đã chuẩn hóa (bỏ gạch, chữ thường). */
    public String hashRecovery(String normalized) {
        return HexFormat.of().formatHex(hmac(recoveryPepper, normalized));
    }

    private static byte[] hmac(byte[] key, String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key, "HmacSHA256"));
            return mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }
}
