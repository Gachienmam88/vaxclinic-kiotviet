package com.vaxclinic.identity.storeprofile;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.identity.auth.twofactor.TwoFactorService;
import com.vaxclinic.identity.storeprofile.StoreProfileModels.VerifyResponse;
import com.vaxclinic.identity.user.AppUser;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;

/**
 * Bước "Xác thực" của các thao tác nhạy cảm trên Hồ sơ cửa hàng. KiotViet gửi OTP SMS; hệ thống này không có nhà cung
 * cấp SMS nên xác thực bằng mã Authenticator (đã bật 2FA) hoặc mật khẩu đăng nhập (chưa bật). Thành công → phiếu xác thực
 * "{userId}.{purpose}.{expEpoch}.{HMAC}" dùng được {@link #TTL} cho đúng 1 loại thao tác của đúng user đó.
 */
@Component
public class StoreActionVerifier {

    static final Duration TTL = Duration.ofMinutes(10);

    private final TwoFactorService twoFactor;
    private final byte[] key;

    public StoreActionVerifier(TwoFactorService twoFactor, @Value("${app.jwt.secret}") String jwtSecret) {
        this.twoFactor = twoFactor;
        this.key = hmac(jwtSecret.getBytes(StandardCharsets.UTF_8), "vaxclinic-store-action-verify-v1");
    }

    public VerifyResponse issue(AppUser user, String purpose, String password, String code) {
        twoFactor.confirmIdentity(user, password, code);
        Instant exp = Instant.now().plus(TTL);
        String body = user.getId() + "." + purpose + "." + exp.getEpochSecond();
        return new VerifyResponse(body + "." + sign(body), exp);
    }

    public void check(UUID userId, String purpose, String token) {
        String[] p = token == null ? new String[0] : token.split("\\.");
        boolean ok = p.length == 4 && p[0].equals(userId.toString()) && p[1].equals(purpose);
        if (ok) {
            String body = p[0] + "." + p[1] + "." + p[2];
            try {
                ok = Long.parseLong(p[2]) > Instant.now().getEpochSecond() && MessageDigest.isEqual(
                        sign(body).getBytes(StandardCharsets.US_ASCII), p[3].getBytes(StandardCharsets.US_ASCII));
            } catch (NumberFormatException e) {
                ok = false;
            }
        }
        if (!ok) {
            throw BusinessException.badRequest("VERIFY_EXPIRED", "Phiên xác thực đã hết hạn. Vui lòng xác thực lại");
        }
    }

    private String sign(String body) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(hmac(key, body));
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
