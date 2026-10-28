package com.vaxclinic.integration.storeprofile;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.integration.storeprofile.CertificateFileParser.Parsed;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDate;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Hồ sơ cửa hàng → Quản lý chữ ký số. Thông tin nhập tay; có thể tải chứng thư công khai (.cer) để tự điền chủ thể / MST /
 * serial / hiệu lực (POST /parse) và lưu kèm bản ghi (certificateBase64 — server đọc lại, giá trị trong file được ưu tiên).
 * Sau mỗi thay đổi đồng bộ cảnh báo "sắp hết hạn" vào Hộp thư đến.
 */
@RestController
@RequestMapping("/api/store-profile/certificates")
@PreAuthorize("hasAuthority('settings.manage')")
public class DigitalCertificateController {

    public record CertificateRequest(@NotBlank(message = "Nhập tên chủ thể") @Size(max = 300) String subjectName,
                                     @Size(max = 20) String taxCode, @Size(max = 150) String representative,
                                     @NotNull @Pattern(regexp = "USB_TOKEN|HSM|RMS", message = "Loại chữ ký không hợp lệ") String signatureType,
                                     @Size(max = 100) String provider, @Size(max = 100) String serialNumber,
                                     LocalDate activatedOn, @NotNull(message = "Nhập ngày hết hạn") LocalDate expiresOn,
                                     @NotNull @Pattern(regexp = "PENDING|APPROVED|REVOKED", message = "Trạng thái chứng thư không hợp lệ") String certStatus,
                                     boolean active, String certificateBase64) {
    }

    private static final String COLUMNS = "id, subject_name, tax_code, representative, signature_type, provider, serial_number,"
            + " activated_on, expires_on, cert_status, active, issuer, cert_der is not null as has_certificate, updated_at";

    private final JdbcTemplate jdbc;
    private final CertificateExpiryAlerts alerts;

    public DigitalCertificateController(JdbcTemplate jdbc, CertificateExpiryAlerts alerts) {
        this.jdbc = jdbc;
        this.alerts = alerts;
    }

    @GetMapping
    public List<Map<String, Object>> list() {
        return jdbc.queryForList("select " + COLUMNS + " from digital_certificates order by expires_on desc, subject_name");
    }

    /** Đọc file .cer để điền sẵn form; không lưu gì. */
    @PostMapping("/parse")
    public Map<String, Object> parse(@RequestParam("file") MultipartFile file) throws IOException {
        Parsed p = CertificateFileParser.parse(file.getBytes());
        var out = new java.util.HashMap<String, Object>();
        out.put("subjectName", p.subjectName());
        out.put("taxCode", p.taxCode());
        out.put("provider", p.provider());
        out.put("serialNumber", p.serialNumber());
        out.put("activatedOn", p.activatedOn());
        out.put("expiresOn", p.expiresOn());
        out.put("issuer", p.issuer());
        out.put("certificateBase64", Base64.getEncoder().encodeToString(p.der()));
        return out;
    }

    @PostMapping
    public List<Map<String, Object>> create(@Valid @RequestBody CertificateRequest r) {
        save(UUID.randomUUID(), r, true);
        return list();
    }

    @PutMapping("/{id}")
    public List<Map<String, Object>> update(@PathVariable UUID id, @Valid @RequestBody CertificateRequest r) {
        save(id, r, false);
        return list();
    }

    @DeleteMapping("/{id}")
    public List<Map<String, Object>> delete(@PathVariable UUID id) {
        jdbc.update("delete from digital_certificates where id = ?", id);
        alerts.syncQuietly();
        return list();
    }

    /** Có file chứng thư → chủ thể / MST / serial / ngày lấy theo file (nguồn đáng tin hơn nhập tay). */
    private void save(UUID id, CertificateRequest r, boolean insert) {
        Parsed p = r.certificateBase64() == null || r.certificateBase64().isBlank() ? null : CertificateFileParser.parseBase64(r.certificateBase64());
        String subject = p != null && p.subjectName() != null ? p.subjectName() : r.subjectName().trim();
        String taxCode = p != null && p.taxCode() != null ? p.taxCode() : blank(r.taxCode());
        String serial = p != null ? p.serialNumber() : blank(r.serialNumber());
        LocalDate from = p != null ? p.activatedOn() : r.activatedOn();
        LocalDate to = p != null ? p.expiresOn() : r.expiresOn();
        if (from != null && to.isBefore(from)) {
            throw BusinessException.badRequest("INVALID_CERT_DATES", "Ngày hết hạn phải sau ngày kích hoạt");
        }
        Object[] args = {subject, taxCode, blank(r.representative()), r.signatureType(), blank(r.provider()), serial, from, to,
                r.certStatus(), r.active(), p == null ? null : p.issuer(), p == null ? null : p.der(), id};
        if (insert) {
            jdbc.update("insert into digital_certificates(subject_name, tax_code, representative, signature_type, provider, serial_number,"
                    + " activated_on, expires_on, cert_status, active, issuer, cert_der, id) values (?,?,?,?,?,?,?,?,?,?,?,?,?)", args);
        } else {
            // không gửi file mới → giữ chứng thư đã lưu
            int n = jdbc.update("update digital_certificates set subject_name = ?, tax_code = ?, representative = ?, signature_type = ?,"
                    + " provider = ?, serial_number = ?, activated_on = ?, expires_on = ?, cert_status = ?, active = ?,"
                    + " issuer = coalesce(?, issuer), cert_der = coalesce(?, cert_der), updated_at = now() where id = ?", args);
            if (n == 0) {
                throw BusinessException.notFound("CERT_NOT_FOUND", "Không tìm thấy chữ ký số");
            }
        }
        alerts.syncQuietly();
    }

    private static String blank(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
