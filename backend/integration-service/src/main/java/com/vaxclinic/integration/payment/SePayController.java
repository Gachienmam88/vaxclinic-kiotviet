package com.vaxclinic.integration.payment;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.integration.common.SecretCipher;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Thanh toán QR báo có tự động qua SePay.
 * 1. Màn bán hàng tạo yêu cầu thanh toán → mã VXCxxxxxxxx, đưa vào nội dung chuyển khoản của mã QR.
 * 2. Khách chuyển khoản → SePay gọi webhook → khớp mã trong nội dung → yêu cầu chuyển PAID khi nhận đủ tiền.
 * 3. Màn bán hàng hỏi trạng thái mỗi vài giây → nhận đủ thì báo "Đã nhận tiền" (và tự hoàn thành hóa đơn nếu bật).
 */
@RestController
public class SePayController {

    private static final Logger log = LoggerFactory.getLogger(SePayController.class);
    private static final Pattern CODE = Pattern.compile("VXC[A-Z0-9]{8}");
    private static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // bỏ O/0, I/1 dễ nhầm
    private static final SecureRandom RANDOM = new SecureRandom();

    public record SettingsRequest(boolean enabled, @Size(max = 200) String apiKey, boolean autoComplete) {
    }

    public record PaymentRequestBody(@NotNull @DecimalMin("1000") BigDecimal amount, @Size(max = 100) String reference,
                                     UUID branchId) {
    }

    /** Dữ liệu SePay gửi (developer.sepay.vn → Tích hợp webhook). */
    public record Webhook(Long id, String gateway, String transactionDate, String accountNumber, String code,
                          String content, String transferType, BigDecimal transferAmount, String referenceCode) {
    }

    private final JdbcTemplate jdbc;
    private final SecretCipher cipher;

    public SePayController(JdbcTemplate jdbc, SecretCipher cipher) {
        this.jdbc = jdbc;
        this.cipher = cipher;
    }

    /** Không trả API key; chỉ báo đã nhập hay chưa. */
    @GetMapping("/api/payments/sepay/settings")
    public Map<String, Object> settings() {
        var rows = jdbc.queryForList("select * from sepay_settings where id = 1");
        var out = new HashMap<String, Object>();
        out.put("enabled", !rows.isEmpty() && (Boolean) rows.get(0).get("enabled"));
        out.put("configured", !rows.isEmpty() && rows.get(0).get("api_key_enc") != null);
        out.put("autoComplete", rows.isEmpty() || (Boolean) rows.get(0).get("auto_complete"));
        return out;
    }

    /** Để trống API key = giữ key cũ. */
    @PutMapping("/api/payments/sepay/settings")
    @PreAuthorize("hasAuthority('settings.manage')")
    public Map<String, Object> saveSettings(@Valid @RequestBody SettingsRequest r) {
        String enc = r.apiKey() == null || r.apiKey().isBlank() ? null : cipher.encrypt(r.apiKey().trim());
        if (r.enabled() && enc == null && !Boolean.TRUE.equals(settings().get("configured"))) {
            throw BusinessException.badRequest("SEPAY_KEY_REQUIRED", "Nhập API key của SePay trước khi bật");
        }
        jdbc.update("""
                insert into sepay_settings(id, enabled, api_key_enc, auto_complete, updated_at) values (1, ?, ?, ?, now())
                on conflict (id) do update set enabled = excluded.enabled, auto_complete = excluded.auto_complete,
                  api_key_enc = coalesce(excluded.api_key_enc, sepay_settings.api_key_enc), updated_at = now()""",
                r.enabled(), enc, r.autoComplete());
        return settings();
    }

    /**
     * Webhook SePay (công khai, không JWT). Xác thực: header "Authorization: Apikey {key}".
     * Phải trả 200 + {"success": true}; lỗi khác → SePay gửi lại (nên xử lý chống trùng theo id).
     */
    @PostMapping("/api/payments/sepay/webhook")
    @Transactional
    public ResponseEntity<Map<String, Object>> webhook(@RequestHeader(value = "Authorization", required = false) String auth,
                                                       @RequestBody Webhook w) {
        var rows = jdbc.queryForList("select enabled, api_key_enc from sepay_settings where id = 1");
        if (rows.isEmpty() || !(Boolean) rows.get(0).get("enabled") || rows.get(0).get("api_key_enc") == null) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of("success", false));
        }
        String expected = cipher.decrypt((String) rows.get(0).get("api_key_enc"));
        String given = auth == null ? "" : auth.trim().replaceFirst("(?i)^Bearer\\s+", "").replaceFirst("(?i)^Apikey\\s+", "");
        if (auth == null || !MessageDigest.isEqual(given.getBytes(StandardCharsets.UTF_8), expected.getBytes(StandardCharsets.UTF_8))) {
            log.warn("SePay webhook rejected: wrong API key");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("success", false));
        }
        if (w.id() == null || w.transferAmount() == null) {
            return ResponseEntity.badRequest().body(Map.of("success", false));
        }
        String code = "in".equalsIgnoreCase(w.transferType()) ? matchCode(w) : null;
        int inserted = jdbc.update("""
                insert into bank_transactions(sepay_id, gateway, transaction_date, account_number, transfer_type, amount, content,
                  reference_code, payment_code) values (?,?,?,?,?,?,?,?,?) on conflict (sepay_id) do nothing""",
                w.id(), w.gateway(), w.transactionDate(), w.accountNumber(), w.transferType(), w.transferAmount(),
                w.content() == null ? null : w.content().substring(0, Math.min(500, w.content().length())), w.referenceCode(), code);
        if (inserted == 1 && code != null) { // SePay gửi lại cùng id → không cộng tiền 2 lần
            jdbc.update("""
                    update payment_requests set paid_amount = paid_amount + ?,
                      status = case when paid_amount + ? >= amount then 'PAID' else status end,
                      paid_at = case when paid_amount + ? >= amount then now() else paid_at end
                    where code = ?""", w.transferAmount(), w.transferAmount(), w.transferAmount(), code);
        }
        return ResponseEntity.ok(Map.of("success", true));
    }

    /** Mã thanh toán: SePay tách sẵn (field code) hoặc tìm trong nội dung — chỉ nhận mã đã tạo ở hệ thống. */
    private String matchCode(Webhook w) {
        for (String text : new String[]{w.code(), w.content()}) {
            if (text == null) {
                continue;
            }
            var m = CODE.matcher(text.toUpperCase());
            while (m.find()) {
                Integer n = jdbc.queryForObject("select count(*) from payment_requests where code = ?", Integer.class, m.group());
                if (n != null && n > 0) {
                    return m.group();
                }
            }
        }
        return null;
    }

    @PostMapping("/api/payment-requests")
    @PreAuthorize("hasAuthority('sales.perform') or hasAuthority('cashbook.manage')")
    public Map<String, Object> createRequest(@Valid @RequestBody PaymentRequestBody r, @AuthenticationPrincipal Jwt jwt) {
        if (!Boolean.TRUE.equals(settings().get("enabled"))) {
            throw BusinessException.badRequest("SEPAY_DISABLED", "Chưa bật báo có tự động SePay");
        }
        var sb = new StringBuilder("VXC");
        for (int i = 0; i < 8; i++) {
            sb.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
        }
        jdbc.update("insert into payment_requests(code, amount, reference, branch_id, created_by) values (?,?,?,?,?)",
                sb.toString(), r.amount(), r.reference(), r.branchId(), UUID.fromString(jwt.getSubject()));
        return request(sb.toString());
    }

    @GetMapping("/api/payment-requests/{code}")
    @PreAuthorize("hasAuthority('sales.perform') or hasAuthority('cashbook.manage')")
    public Map<String, Object> request(@PathVariable String code) {
        var rows = jdbc.queryForList("select code, amount, paid_amount, status, paid_at from payment_requests where code = ?", code);
        if (rows.isEmpty()) {
            throw BusinessException.notFound("PAYMENT_REQUEST_NOT_FOUND", "Không tìm thấy yêu cầu thanh toán");
        }
        var r = rows.get(0);
        return Map.of("code", r.get("code"), "amount", r.get("amount"), "paidAmount", r.get("paid_amount"), "status", r.get("status"),
                "autoComplete", settings().get("autoComplete"));
    }

    /** Giao dịch ngân hàng SePay đã báo (mới nhất trước). */
    @GetMapping("/api/payments/transactions")
    @PreAuthorize("hasAuthority('cashbook.manage')")
    public List<Map<String, Object>> transactions(@RequestParam(defaultValue = "100") int limit) {
        return jdbc.queryForList("""
                select sepay_id, gateway, transaction_date, account_number, transfer_type, amount, content, reference_code,
                  payment_code, received_at from bank_transactions order by received_at desc limit ?""", Math.min(limit, 500));
    }
}
