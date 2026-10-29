package com.vaxclinic.integration.payment;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Thanh toán QR báo có tự động qua SePay.
 * 1. Màn bán hàng tạo yêu cầu thanh toán → mã VXCxxxxxxxx, đưa vào nội dung chuyển khoản của mã QR.
 * 2. Khách chuyển khoản → SePay gọi webhook → khớp mã trong nội dung → yêu cầu chuyển PAID khi nhận đủ tiền.
 * 3. Màn bán hàng hỏi trạng thái mỗi vài giây → nhận đủ thì báo "Đã nhận tiền" (và tự hoàn thành hóa đơn nếu bật).
 * Nghiệp vụ ở {@link SePayService}.
 */
@RestController
public class SePayController {

    public record SettingsRequest(boolean enabled, @Size(max = 200) String apiKey, boolean autoComplete) {
    }

    public record PaymentRequestBody(@NotNull @DecimalMin("1000") BigDecimal amount, @Size(max = 100) String reference,
                                     UUID branchId) {
    }

    /** Dữ liệu SePay gửi (developer.sepay.vn → Tích hợp webhook). */
    public record Webhook(Long id, String gateway, String transactionDate, String accountNumber, String code,
                          String content, String transferType, BigDecimal transferAmount, String referenceCode) {
    }

    private final SePayService service;

    public SePayController(SePayService service) {
        this.service = service;
    }

    /** Không trả API key; chỉ báo đã nhập hay chưa. */
    @GetMapping("/api/payments/sepay/settings")
    public Map<String, Object> settings() {
        return service.settings();
    }

    /** Để trống API key = giữ key cũ. */
    @PutMapping("/api/payments/sepay/settings")
    @PreAuthorize("hasAuthority('settings.manage')")
    public Map<String, Object> saveSettings(@Valid @RequestBody SettingsRequest r) {
        return service.saveSettings(r);
    }

    /**
     * Webhook SePay (công khai, không JWT). Xác thực: header "Authorization: Apikey {key}".
     * Phải trả 200 + {"success": true}; lỗi khác → SePay gửi lại (chống trùng theo id ở {@link SePayService#webhook}).
     */
    @PostMapping("/api/payments/sepay/webhook")
    public ResponseEntity<Map<String, Object>> webhook(@RequestHeader(value = "Authorization", required = false) String auth,
                                                       @RequestBody Webhook w) {
        return switch (service.webhook(auth, w)) {
            case DISABLED -> ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of("success", false));
            case UNAUTHORIZED -> ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("success", false));
            case INVALID -> ResponseEntity.badRequest().body(Map.of("success", false));
            case OK -> ResponseEntity.ok(Map.of("success", true));
        };
    }

    @PostMapping("/api/payment-requests")
    @PreAuthorize("hasAuthority('sales.perform') or hasAuthority('cashbook.manage')")
    public Map<String, Object> createRequest(@Valid @RequestBody PaymentRequestBody r, @AuthenticationPrincipal Jwt jwt) {
        return service.createRequest(r, jwt.getSubject());
    }

    @GetMapping("/api/payment-requests/{code}")
    @PreAuthorize("hasAuthority('sales.perform') or hasAuthority('cashbook.manage')")
    public Map<String, Object> request(@PathVariable String code) {
        return service.request(code);
    }

    /** Giao dịch ngân hàng SePay đã báo (mới nhất trước). */
    @GetMapping("/api/payments/transactions")
    @PreAuthorize("hasAuthority('cashbook.manage')")
    public List<Map<String, Object>> transactions(@RequestParam(defaultValue = "100") int limit) {
        return service.transactions(limit);
    }
}
