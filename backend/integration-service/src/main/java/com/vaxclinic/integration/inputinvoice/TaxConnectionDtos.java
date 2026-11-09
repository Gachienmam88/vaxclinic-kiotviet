package com.vaxclinic.integration.inputinvoice;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/** Request / response của API Hóa đơn đầu vào → "Danh sách kết nối" (tài khoản cổng thuế). */
public final class TaxConnectionDtos {

    private TaxConnectionDtos() {
    }

    public record ConnectionRequest(@NotBlank(message = "Nhập mã số thuế") String taxCode,
                                    @NotBlank(message = "Nhập tên đăng nhập") String username, String password) {
    }

    public record SyncRequest(@NotBlank String captchaKey, @NotBlank(message = "Nhập mã captcha") String captchaValue,
                              @NotNull LocalDate from, @NotNull LocalDate to) {
    }

    public record ConnectionResponse(UUID id, String taxCode, String username, boolean active, Instant lastSyncedAt,
                                     String lastError) {
    }

    /** POST /api/tax-connections (201). */
    public record CreatedResponse(UUID id) {
    }

    /** Kết quả đồng bộ: số hóa đơn cổng trả về, số hóa đơn mới. */
    public record SyncResult(int found, int added) {
    }
}
