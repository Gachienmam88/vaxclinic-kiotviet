package com.vaxclinic.sales.cashbook;

import jakarta.validation.constraints.NotBlank;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
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

    /** Phiếu thu / chi (cùng các trường JSON với entity {@link CashVoucher}). */
    public record CashVoucherView(UUID id, String code, String voucherType, String fund, UUID bankAccountId, String category,
                                  BigDecimal amount, Instant occurredAt, UUID branchId, String partnerType, UUID partnerId,
                                  String partnerName, String partnerPhone, UUID collectorId, String collectorName,
                                  UUID createdBy, String createdByName, boolean accounting, boolean affectsDebt,
                                  String status, String sourceType, UUID sourceId, String note, Instant createdAt) {

        public static CashVoucherView of(CashVoucher v) {
            return new CashVoucherView(v.getId(), v.getCode(), v.getVoucherType(), v.getFund(), v.getBankAccountId(),
                    v.getCategory(), v.getAmount(), v.getOccurredAt(), v.getBranchId(), v.getPartnerType(), v.getPartnerId(),
                    v.getPartnerName(), v.getPartnerPhone(), v.getCollectorId(), v.getCollectorName(), v.getCreatedBy(),
                    v.getCreatedByName(), v.isAccounting(), v.isAffectsDebt(), v.getStatus(), v.getSourceType(),
                    v.getSourceId(), v.getNote(), v.getCreatedAt());
        }
    }

    /** GET /api/cashbook/{id}: phiếu + các hóa đơn được phân bổ. */
    public record VoucherDetail(CashVoucherView voucher, List<Allocated> allocations) {
    }

    /** Tài khoản ngân hàng / ví (cùng các trường JSON với entity {@link BankAccount}). */
    public record BankAccountView(UUID id, String bankName, String bankBin, String accountNo, String accountName,
                                  boolean active, String kind, String note) {

        public static BankAccountView of(BankAccount b) {
            return new BankAccountView(b.getId(), b.getBankName(), b.getBankBin(), b.getAccountNo(), b.getAccountName(),
                    b.isActive(), b.getKind(), b.getNote());
        }
    }

    /** Nội dung mã VietQR cho tài khoản (frontend vẽ thành ảnh QR). */
    public record VietQr(String payload, String bankName, String accountNo, String accountName) {
    }
}
