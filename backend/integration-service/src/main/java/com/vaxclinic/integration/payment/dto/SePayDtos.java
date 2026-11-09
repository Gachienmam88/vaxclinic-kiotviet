package com.vaxclinic.integration.payment.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.util.Map;
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

    /** Thiết lập SePay (không trả API key; configured = đã nhập key). */
    public record SettingsResponse(boolean enabled, boolean configured, boolean autoComplete) {
    }

    /** Thân phản hồi webhook SePay: {"success": true|false}. */
    public record WebhookResponse(boolean success) {
    }

    /** Yêu cầu thanh toán QR; autoComplete lấy theo thiết lập SePay hiện tại. */
    public record PaymentRequestResponse(String code, BigDecimal amount, BigDecimal paidAmount, String status,
                                         boolean autoComplete) {
    }

    /**
     * 1 dòng bank_transactions — tên khóa JSON = tên cột (snake_case) và kiểu giá trị = kiểu JDBC
     * (received_at: java.sql.Timestamp) như khi trả thẳng dòng queryForList trước đây.
     */
    public record BankTransaction(@JsonProperty("sepay_id") Long sepayId, @JsonProperty("gateway") String gateway,
                                  @JsonProperty("transaction_date") String transactionDate,
                                  @JsonProperty("account_number") String accountNumber,
                                  @JsonProperty("transfer_type") String transferType, @JsonProperty("amount") BigDecimal amount,
                                  @JsonProperty("content") String content, @JsonProperty("reference_code") String referenceCode,
                                  @JsonProperty("payment_code") String paymentCode, @JsonProperty("received_at") Timestamp receivedAt) {

        /** Từ 1 dòng queryForList (giữ nguyên giá trị JDBC). */
        public static BankTransaction fromRow(Map<String, Object> row) {
            return new BankTransaction((Long) row.get("sepay_id"), (String) row.get("gateway"), (String) row.get("transaction_date"),
                    (String) row.get("account_number"), (String) row.get("transfer_type"), (BigDecimal) row.get("amount"),
                    (String) row.get("content"), (String) row.get("reference_code"), (String) row.get("payment_code"),
                    (Timestamp) row.get("received_at"));
        }
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
