package com.vaxclinic.integration.payment;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.integration.common.SecretCipher;
import com.vaxclinic.integration.payment.SePayController.PaymentRequestBody;
import com.vaxclinic.integration.payment.SePayController.SettingsRequest;
import com.vaxclinic.integration.payment.SePayController.Webhook;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Thanh toán QR báo có tự động qua SePay: thiết lập (API key mã hóa AES-GCM, không bao giờ trả ra / ghi log),
 * xác thực + chống trùng webhook, yêu cầu thanh toán mã VXCxxxxxxxx và danh sách giao dịch.
 */
@Service
public class SePayService {

    /** Kết quả webhook; controller đổi sang HTTP status (body luôn {"success": ok}). */
    public enum WebhookResult { OK, DISABLED, UNAUTHORIZED, INVALID }

    private static final Logger log = LoggerFactory.getLogger(SePayService.class);
    private static final Pattern CODE = Pattern.compile("VXC[A-Z0-9]{8}");
    private static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // bỏ O/0, I/1 dễ nhầm
    private static final SecureRandom RANDOM = new SecureRandom();

    private final SePayRepository sepay;
    private final SecretCipher cipher;

    public SePayService(SePayRepository sepay, SecretCipher cipher) {
        this.sepay = sepay;
        this.cipher = cipher;
    }

    /** Không trả API key; chỉ báo đã nhập hay chưa. */
    public Map<String, Object> settings() {
        var s = sepay.findSettings();
        var out = new HashMap<String, Object>();
        out.put("enabled", s != null && (Boolean) s.get("enabled"));
        out.put("configured", s != null && s.get("api_key_enc") != null);
        out.put("autoComplete", s == null || (Boolean) s.get("auto_complete"));
        return out;
    }

    /** Để trống API key = giữ key cũ. */
    public Map<String, Object> saveSettings(SettingsRequest r) {
        String enc = r.apiKey() == null || r.apiKey().isBlank() ? null : cipher.encrypt(r.apiKey().trim());
        if (r.enabled() && enc == null && !Boolean.TRUE.equals(settings().get("configured"))) {
            throw BusinessException.badRequest("SEPAY_KEY_REQUIRED", "Nhập API key của SePay trước khi bật");
        }
        sepay.upsertSettings(r.enabled(), enc, r.autoComplete());
        return settings();
    }

    /**
     * Xác thực header "Authorization: Apikey {key}" (so sánh hằng thời gian), lưu giao dịch chống trùng theo id SePay,
     * cộng tiền vào yêu cầu thanh toán khớp mã chỉ khi giao dịch mới.
     */
    @Transactional
    public WebhookResult webhook(String auth, Webhook w) {
        var s = sepay.findWebhookAuth();
        if (s == null || !(Boolean) s.get("enabled") || s.get("api_key_enc") == null) {
            return WebhookResult.DISABLED;
        }
        String expected = cipher.decrypt((String) s.get("api_key_enc"));
        String given = auth == null ? "" : auth.trim().replaceFirst("(?i)^Bearer\\s+", "").replaceFirst("(?i)^Apikey\\s+", "");
        if (auth == null || !MessageDigest.isEqual(given.getBytes(StandardCharsets.UTF_8), expected.getBytes(StandardCharsets.UTF_8))) {
            log.warn("SePay webhook rejected: wrong API key");
            return WebhookResult.UNAUTHORIZED;
        }
        if (w.id() == null || w.transferAmount() == null) {
            return WebhookResult.INVALID;
        }
        String code = "in".equalsIgnoreCase(w.transferType()) ? matchCode(w) : null;
        int inserted = sepay.insertBankTransaction(w.id(), w.gateway(), w.transactionDate(), w.accountNumber(), w.transferType(),
                w.transferAmount(), w.content() == null ? null : w.content().substring(0, Math.min(500, w.content().length())),
                w.referenceCode(), code);
        if (inserted == 1 && code != null) { // SePay gửi lại cùng id → không cộng tiền 2 lần
            sepay.creditPaymentRequest(code, w.transferAmount());
        }
        return WebhookResult.OK;
    }

    /** Mã thanh toán: SePay tách sẵn (field code) hoặc tìm trong nội dung — chỉ nhận mã đã tạo ở hệ thống. */
    private String matchCode(Webhook w) {
        for (String text : new String[]{w.code(), w.content()}) {
            if (text == null) {
                continue;
            }
            var m = CODE.matcher(text.toUpperCase());
            while (m.find()) {
                if (sepay.paymentRequestExists(m.group())) {
                    return m.group();
                }
            }
        }
        return null;
    }

    /** createdBy: subject của JWT người tạo (UUID). */
    public Map<String, Object> createRequest(PaymentRequestBody r, String createdBy) {
        if (!Boolean.TRUE.equals(settings().get("enabled"))) {
            throw BusinessException.badRequest("SEPAY_DISABLED", "Chưa bật báo có tự động SePay");
        }
        var sb = new StringBuilder("VXC");
        for (int i = 0; i < 8; i++) {
            sb.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
        }
        sepay.insertPaymentRequest(sb.toString(), r.amount(), r.reference(), r.branchId(), UUID.fromString(createdBy));
        return request(sb.toString());
    }

    public Map<String, Object> request(String code) {
        var r = sepay.findPaymentRequest(code);
        if (r == null) {
            throw BusinessException.notFound("PAYMENT_REQUEST_NOT_FOUND", "Không tìm thấy yêu cầu thanh toán");
        }
        return Map.of("code", r.get("code"), "amount", r.get("amount"), "paidAmount", r.get("paid_amount"), "status", r.get("status"),
                "autoComplete", settings().get("autoComplete"));
    }

    public List<Map<String, Object>> transactions(int limit) {
        return sepay.findTransactions(Math.min(limit, 500));
    }
}
