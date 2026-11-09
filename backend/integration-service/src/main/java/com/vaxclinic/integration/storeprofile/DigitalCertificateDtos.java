package com.vaxclinic.integration.storeprofile;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.sql.Timestamp;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

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

    /** POST /parse: thông tin đọc từ file .cer để điền sẵn form (certificateBase64 = nội dung DER). */
    public record ParsedCertificate(String subjectName, String taxCode, String provider, String serialNumber,
                                    LocalDate activatedOn, LocalDate expiresOn, String issuer, String certificateBase64) {
    }

    /**
     * 1 dòng digital_certificates (không có cert_der) — tên khóa JSON = tên cột (snake_case) và kiểu giá trị = kiểu JDBC
     * (ngày: java.sql.Date, updated_at: java.sql.Timestamp) như khi trả thẳng dòng queryForList trước đây.
     */
    public record CertificateItem(@JsonProperty("id") UUID id, @JsonProperty("subject_name") String subjectName,
                                  @JsonProperty("tax_code") String taxCode, @JsonProperty("representative") String representative,
                                  @JsonProperty("signature_type") String signatureType, @JsonProperty("provider") String provider,
                                  @JsonProperty("serial_number") String serialNumber,
                                  @JsonProperty("activated_on") java.sql.Date activatedOn,
                                  @JsonProperty("expires_on") java.sql.Date expiresOn, @JsonProperty("cert_status") String certStatus,
                                  @JsonProperty("active") Boolean active, @JsonProperty("issuer") String issuer,
                                  @JsonProperty("has_certificate") Boolean hasCertificate,
                                  @JsonProperty("updated_at") Timestamp updatedAt) {

        /** Từ 1 dòng queryForList (giữ nguyên giá trị JDBC). */
        public static CertificateItem fromRow(Map<String, Object> row) {
            return new CertificateItem((UUID) row.get("id"), (String) row.get("subject_name"), (String) row.get("tax_code"),
                    (String) row.get("representative"), (String) row.get("signature_type"), (String) row.get("provider"),
                    (String) row.get("serial_number"), (java.sql.Date) row.get("activated_on"), (java.sql.Date) row.get("expires_on"),
                    (String) row.get("cert_status"), (Boolean) row.get("active"), (String) row.get("issuer"),
                    (Boolean) row.get("has_certificate"), (Timestamp) row.get("updated_at"));
        }
    }
}
