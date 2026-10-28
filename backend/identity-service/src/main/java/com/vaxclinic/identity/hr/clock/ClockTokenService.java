package com.vaxclinic.identity.hr.clock;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;

/**
 * Mã QR chấm công của chi nhánh (chống chấm hộ từ xa): token = "{branchId}.{slot}.{HMAC}", slot = epochSecond / 60.
 * Màn hình tại quầy làm mới mã mỗi 60 giây; server chỉ nhận mã của phút hiện tại hoặc phút liền trước (tối đa ~2 phút tuổi).
 * Khóa HMAC dẫn xuất từ ENCRYPTION_KEY (thiếu thì JWT secret) — không lưu trong DB, không gửi ra trình duyệt.
 */
@Component
public class ClockTokenService {

    public static final int SLOT_SECONDS = 60;

    public record Verified(UUID branchId, long slot) {
    }

    private final byte[] key;

    public ClockTokenService(@Value("${app.hr.clock-secret:}") String secret, @Value("${app.jwt.secret}") String jwtSecret) {
        String base = secret == null || secret.isBlank() ? jwtSecret : secret;
        this.key = hmac(base.getBytes(StandardCharsets.UTF_8), "vaxclinic-hr-clock-qr-v1");
    }

    public static long slotOf(Instant t) {
        return t.getEpochSecond() / SLOT_SECONDS;
    }

    public String issue(UUID branchId, Instant now) {
        long slot = slotOf(now);
        return branchId + "." + slot + "." + sign(branchId, slot);
    }

    /** Hết hạn / giả mạo / sai định dạng → null. */
    public Verified verify(String token, Instant now) {
        if (token == null) {
            return null;
        }
        String[] p = token.trim().split("\\.");
        if (p.length != 3) {
            return null;
        }
        try {
            UUID branch = UUID.fromString(p[0]);
            long slot = Long.parseLong(p[1]);
            long current = slotOf(now);
            if (slot > current || slot < current - 1) {
                return null;
            }
            boolean ok = MessageDigest.isEqual(sign(branch, slot).getBytes(StandardCharsets.US_ASCII), p[2].getBytes(StandardCharsets.US_ASCII));
            return ok ? new Verified(branch, slot) : null;
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    /** Thời điểm mã của slot hết hiệu lực (hết phút kế tiếp). */
    public static Instant expiresAt(long slot) {
        return Instant.ofEpochSecond((slot + 2) * SLOT_SECONDS);
    }

    private String sign(UUID branch, long slot) {
        byte[] mac = hmac(key, branch + ":" + slot);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(java.util.Arrays.copyOf(mac, 16));
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
