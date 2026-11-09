package com.vaxclinic.integration.payment;

import com.vaxclinic.integration.payment.SePayDtos.PaymentRequestBody;
import com.vaxclinic.integration.payment.SePayDtos.SettingsRequest;
import com.vaxclinic.integration.payment.SePayDtos.Webhook;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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

import java.util.List;
import java.util.Map;

/**
 * Thanh toán QR báo có tự động qua SePay.
 * 1. Màn bán hàng tạo yêu cầu thanh toán → mã VXCxxxxxxxx, đưa vào nội dung chuyển khoản của mã QR.
 * 2. Khách chuyển khoản → SePay gọi webhook → khớp mã trong nội dung → yêu cầu chuyển PAID khi nhận đủ tiền.
 * 3. Màn bán hàng hỏi trạng thái mỗi vài giây → nhận đủ thì báo "Đã nhận tiền" (và tự hoàn thành hóa đơn nếu bật).
 */
@RestController
public class SePayController {

    private static final Logger log = LoggerFactory.getLogger(SePayController.class);

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
     * Phải trả 200 + {"success": true}; lỗi khác → SePay gửi lại (nên xử lý chống trùng theo id).
     * Xử lý (trong 1 transaction) ở {@link SePayService#webhook}.
     */
    @PostMapping("/api/payments/sepay/webhook")
    public ResponseEntity<Map<String, Object>> webhook(@RequestHeader(value = "Authorization", required = false) String auth,
                                                       @RequestBody Webhook w) {
        return switch (service.webhook(auth, w)) {
            case NOT_ENABLED -> ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of("success", false));
            case UNAUTHORIZED -> {
                log.warn("SePay webhook rejected: wrong API key");
                yield ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("success", false));
            }
            case INVALID -> ResponseEntity.badRequest().body(Map.of("success", false));
            case ACCEPTED -> ResponseEntity.ok(Map.of("success", true));
        };
    }

    @PostMapping("/api/payment-requests")
    @PreAuthorize("hasAuthority('sales.perform') or hasAuthority('cashbook.manage')")
    public Map<String, Object> createRequest(@Valid @RequestBody PaymentRequestBody r, @AuthenticationPrincipal Jwt jwt) {
        return service.createRequest(r, jwt);
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
