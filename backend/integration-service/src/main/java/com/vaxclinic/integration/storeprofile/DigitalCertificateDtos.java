package com.vaxclinic.integration.storeprofile;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

/** Request / response của API Hồ sơ cửa hàng → Quản lý chữ ký số. */
public final class DigitalCertificateDtos {

    private DigitalCertificateDtos() {
    }

    public record CertificateRequest(@NotBlank(message = "Nhập tên chủ thể") @Size(max = 300) String subjectName,
                                     @Size(max = 20) String taxCode, @Size(max = 150) String representative,
                                     @NotNull @Pattern(regexp = "USB_TOKEN|HSM|RMS", message = "Loại chữ ký không hợp lệ") String signatureType,
                                     @Size(max = 100) String provider, @Size(max = 100) String serialNumber,
                                     LocalDate activatedOn, @NotNull(message = "Nhập ngày hết hạn") LocalDate expiresOn,
                                     @NotNull @Pattern(regexp = "PENDING|APPROVED|REVOKED", message = "Trạng thái chứng thư không hợp lệ") String certStatus,
                                     boolean active, String certificateBase64) {
    }
}
