package com.vaxclinic.integration.payment;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.UUID;

/** Request / response của API thanh toán QR SePay. */
public final class SePayDtos {

    private SePayDtos() {
    }

    public record SettingsRequest(boolean enabled, @Size(max = 200) String apiKey, boolean autoComplete) {
    }

    public record PaymentRequestBody(@NotNull @DecimalMin("1000") BigDecimal amount, @Size(max = 100) String reference,
                                     UUID branchId) {
    }

    /** Dữ liệu SePay gửi (developer.sepay.vn → Tích hợp webhook). */
    public record Webhook(Long id, String gateway, String transactionDate, String accountNumber, String code,
                          String content, String transferType, BigDecimal transferAmount, String referenceCode) {
    }

    /** Kết quả xử lý webhook; controller dựng ResponseEntity tương ứng. */
    public enum WebhookOutcome {
        /** Chưa bật / chưa có API key → 503. */
        NOT_ENABLED,
        /** Sai API key → 401. */
        UNAUTHORIZED,
        /** Thiếu id / số tiền → 400. */
        INVALID,
        /** Đã ghi nhận → 200. */
        ACCEPTED
    }
}
