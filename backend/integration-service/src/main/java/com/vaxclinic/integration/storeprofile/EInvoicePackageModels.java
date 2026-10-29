package com.vaxclinic.integration.storeprofile;

import com.vaxclinic.integration.storeprofile.EInvoicePackageAllocator.PkgUsage;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.List;

/** DTO của API gói hóa đơn điện tử (/api/store-profile/einvoice). */
public final class EInvoicePackageModels {

    private EInvoicePackageModels() {
    }

    public record PackageRequest(@NotBlank(message = "Nhập tên gói") @Size(max = 100) String name,
                                 @NotNull(message = "Nhập số hóa đơn") @Min(value = 1, message = "Số hóa đơn phải lớn hơn 0")
                                 @Max(10_000_000) Integer quantity,
                                 @NotNull(message = "Nhập ngày bắt đầu") LocalDate startDate,
                                 @NotNull(message = "Nhập ngày hết hạn") LocalDate endDate) {
    }

    /** account: tên đăng nhập MISA; configured: đã lưu đủ thiết lập + mật khẩu. */
    public record Summary(String account, boolean configured, String issuer, long totalQuantity, long published, long remaining,
                          long unallocated, LocalDate serviceExpiry, List<PkgUsage> packages) {
    }
}
