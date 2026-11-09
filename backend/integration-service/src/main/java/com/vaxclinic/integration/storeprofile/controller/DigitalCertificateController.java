package com.vaxclinic.integration.storeprofile.controller;

import com.vaxclinic.integration.storeprofile.dto.DigitalCertificateDtos.CertificateItem;
import com.vaxclinic.integration.storeprofile.dto.DigitalCertificateDtos.CertificateRequest;
import com.vaxclinic.integration.storeprofile.dto.DigitalCertificateDtos.ParsedCertificate;
import com.vaxclinic.integration.storeprofile.service.CertificateFileParser.Parsed;
import com.vaxclinic.integration.storeprofile.service.CertificateFileParser;
import com.vaxclinic.integration.storeprofile.service.DigitalCertificateService;
import jakarta.validation.Valid;
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
import java.util.Base64;
import java.util.List;
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

    private final DigitalCertificateService service;

    public DigitalCertificateController(DigitalCertificateService service) {
        this.service = service;
    }

    @GetMapping
    public List<CertificateItem> list() {
        return service.list();
    }

    /** Đọc file .cer để điền sẵn form; không lưu gì. */
    @PostMapping("/parse")
    public ParsedCertificate parse(@RequestParam("file") MultipartFile file) throws IOException {
        Parsed p = CertificateFileParser.parse(file.getBytes());
        return new ParsedCertificate(p.subjectName(), p.taxCode(), p.provider(), p.serialNumber(), p.activatedOn(),
                p.expiresOn(), p.issuer(), Base64.getEncoder().encodeToString(p.der()));
    }

    @PostMapping
    public List<CertificateItem> create(@Valid @RequestBody CertificateRequest r) {
        return service.create(r);
    }

    @PutMapping("/{id}")
    public List<CertificateItem> update(@PathVariable UUID id, @Valid @RequestBody CertificateRequest r) {
        return service.update(id, r);
    }

    @DeleteMapping("/{id}")
    public List<CertificateItem> delete(@PathVariable UUID id) {
        return service.delete(id);
    }
}
