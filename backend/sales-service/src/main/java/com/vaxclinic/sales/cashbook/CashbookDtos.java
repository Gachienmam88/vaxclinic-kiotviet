package com.vaxclinic.sales.cashbook;

import jakarta.validation.constraints.NotBlank;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/** Request / response của Sổ quỹ và tài khoản ngân hàng. */
public final class CashbookDtos {

    private CashbookDtos() {
    }

    public record Allocated(UUID invoiceId, String invoiceCode, Instant soldAt, BigDecimal invoiceTotal, BigDecimal amount) {
    }

    /** kind: BANK (mặc định) / EWALLET — với ví: bankName = tên ví, accountNo = số điện thoại / mã ví. */
    public record BankAccountRequest(@NotBlank String bankName, String bankBin, @NotBlank String accountNo,
                                     @NotBlank String accountName,
                                     @jakarta.validation.constraints.Pattern(regexp = "BANK|EWALLET") String kind,
                                     @jakarta.validation.constraints.Size(max = 300) String note) {
    }
}
