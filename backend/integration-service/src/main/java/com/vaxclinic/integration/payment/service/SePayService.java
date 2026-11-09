package com.vaxclinic.integration.payment.service;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.integration.common.SecretCipher;
import com.vaxclinic.integration.payment.dto.SePayDtos.BankTransaction;
import com.vaxclinic.integration.payment.dto.SePayDtos.PaymentRequestBody;
import com.vaxclinic.integration.payment.dto.SePayDtos.PaymentRequestResponse;
import com.vaxclinic.integration.payment.dto.SePayDtos.SettingsRequest;
import com.vaxclinic.integration.payment.dto.SePayDtos.SettingsResponse;
import com.vaxclinic.integration.payment.dto.SePayDtos.Webhook;
import com.vaxclinic.integration.payment.dto.SePayDtos.WebhookOutcome;
import com.vaxclinic.integration.payment.repository.SePayRepository;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Thanh toán QR báo có tự động qua SePay: thiết lập, xử lý webhook (xác thực API key, khớp mã thanh toán, cộng tiền),
 * tạo / tra cứu yêu cầu thanh toán.
 */
@Service
public class SePayService {

    private static final Pattern CODE = Pattern.compile("VXC[A-Z0-9]{8}");
    private static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // bỏ O/0, I/1 dễ nhầm
    private static final SecureRandom RANDOM = new SecureRandom();

    private final SePayRepository repo;
    private final SecretCipher cipher;

    public SePayService(SePayRepository repo, SecretCipher cipher) {
        this.repo = repo;
        this.cipher = cipher;
    }

    /** Không trả API key; chỉ báo đã nhập hay chưa. */
    public SettingsResponse settings() {
        var rows = repo.findSettingsRows();
        return new SettingsResponse(!rows.isEmpty() && (Boolean) rows.get(0).get("enabled"),
                !rows.isEmpty() && rows.get(0).get("api_key_enc") != null,
                rows.isEmpty() || (Boolean) rows.get(0).get("auto_complete"));
    }

    /** Để trống API key = giữ key cũ. */
    public SettingsResponse saveSettings(SettingsRequest r) {
        String enc = r.apiKey() == null || r.apiKey().isBlank() ? null : cipher.encrypt(r.apiKey().trim());
        if (r.enabled() && enc == null && !settings().configured()) {
            throw BusinessException.badRequest("SEPAY_KEY_REQUIRED", "Nhập API key của SePay trước khi bật");
        }
        repo.upsertSettings(r.enabled(), enc, r.autoComplete());
        return settings();
    }

    /**
     * Webhook SePay. Xác thực: header "Authorization: Apikey {key}".
     * Toàn bộ (đọc thiết lập, khớp mã, ghi giao dịch, cộng tiền) trong 1 transaction.
     */
    @Transactional
    public WebhookOutcome webhook(String auth, Webhook w) {
        var rows = repo.findWebhookSettingsRows();
        if (rows.isEmpty() || !(Boolean) rows.get(0).get("enabled") || rows.get(0).get("api_key_enc") == null) {
            return WebhookOutcome.NOT_ENABLED;
        }
        String expected = cipher.decrypt((String) rows.get(0).get("api_key_enc"));
        String given = auth == null ? "" : auth.trim().replaceFirst("(?i)^Bearer\\s+", "").replaceFirst("(?i)^Apikey\\s+", "");
        if (auth == null || !MessageDigest.isEqual(given.getBytes(StandardCharsets.UTF_8), expected.getBytes(StandardCharsets.UTF_8))) {
            return WebhookOutcome.UNAUTHORIZED;
        }
        if (w.id() == null || w.transferAmount() == null) {
            return WebhookOutcome.INVALID;
        }
        String code = "in".equalsIgnoreCase(w.transferType()) ? matchCode(w) : null;
        int inserted = repo.insertBankTransaction(w, code);
        if (inserted == 1 && code != null) { // SePay gửi lại cùng id → không cộng tiền 2 lần
            repo.addPaidAmount(code, w.transferAmount());
        }
        return WebhookOutcome.ACCEPTED;
    }

    /** Mã thanh toán: SePay tách sẵn (field code) hoặc tìm trong nội dung — chỉ nhận mã đã tạo ở hệ thống. */
    private String matchCode(Webhook w) {
        for (String text : new String[]{w.code(), w.content()}) {
            if (text == null) {
                continue;
            }
            var m = CODE.matcher(text.toUpperCase());
            while (m.find()) {
                if (repo.paymentRequestExists(m.group())) {
                    return m.group();
                }
            }
        }
        return null;
    }

    /** jwt: người tạo (subject đọc sau khi kiểm tra SePay đã bật, như trước). */
    public PaymentRequestResponse createRequest(PaymentRequestBody r, Jwt jwt) {
        if (!settings().enabled()) {
            throw BusinessException.badRequest("SEPAY_DISABLED", "Chưa bật báo có tự động SePay");
        }
        var sb = new StringBuilder("VXC");
        for (int i = 0; i < 8; i++) {
            sb.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
        }
        repo.insertPaymentRequest(sb.toString(), r.amount(), r.reference(), r.branchId(), UUID.fromString(jwt.getSubject()));
        return request(sb.toString());
    }

    public PaymentRequestResponse request(String code) {
        var rows = repo.findPaymentRequestRows(code);
        if (rows.isEmpty()) {
            throw BusinessException.notFound("PAYMENT_REQUEST_NOT_FOUND", "Không tìm thấy yêu cầu thanh toán");
        }
        var r = rows.get(0);
        return new PaymentRequestResponse((String) r.get("code"), (BigDecimal) r.get("amount"), (BigDecimal) r.get("paid_amount"),
                (String) r.get("status"), settings().autoComplete());
    }

    /** Giao dịch ngân hàng SePay đã báo (mới nhất trước). */
    public List<BankTransaction> transactions(int limit) {
        return repo.transactions(Math.min(limit, 500));
    }
}
