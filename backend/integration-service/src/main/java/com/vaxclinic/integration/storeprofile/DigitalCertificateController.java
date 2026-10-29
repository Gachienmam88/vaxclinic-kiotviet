package com.vaxclinic.integration.storeprofile;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
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
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Hồ sơ cửa hàng → Quản lý chữ ký số. Thông tin nhập tay; có thể tải chứng thư công khai (.cer) để tự điền (POST /parse)
 * và lưu kèm bản ghi (certificateBase64). Nghiệp vụ ở {@link DigitalCertificateService}.
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

    private final DigitalCertificateService service;

    public DigitalCertificateController(DigitalCertificateService service) {
        this.service = service;
    }

    @GetMapping
    public List<Map<String, Object>> list() {
        return service.list();
    }

    @PostMapping("/parse")
    public Map<String, Object> parse(@RequestParam("file") MultipartFile file) throws IOException {
        return service.parse(file.getBytes());
    }

    @PostMapping
    public List<Map<String, Object>> create(@Valid @RequestBody CertificateRequest r) {
        return service.create(r);
    }

    @PutMapping("/{id}")
    public List<Map<String, Object>> update(@PathVariable UUID id, @Valid @RequestBody CertificateRequest r) {
        return service.update(id, r);
    }

    @DeleteMapping("/{id}")
    public List<Map<String, Object>> delete(@PathVariable UUID id) {
        return service.delete(id);
    }
}
