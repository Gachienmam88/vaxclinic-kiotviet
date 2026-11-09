package com.vaxclinic.integration.storeprofile;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.integration.storeprofile.CertificateFileParser.Parsed;
import com.vaxclinic.integration.storeprofile.DigitalCertificateDtos.CertificateRequest;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Quản lý chữ ký số: thông tin nhập tay, hoặc lấy theo chứng thư công khai (.cer) gửi kèm.
 * Sau mỗi thay đổi đồng bộ cảnh báo "sắp hết hạn" vào Hộp thư đến.
 */
@Service
public class DigitalCertificateService {

    private final DigitalCertificateRepository repo;
    private final CertificateExpiryAlerts alerts;

    public DigitalCertificateService(DigitalCertificateRepository repo, CertificateExpiryAlerts alerts) {
        this.repo = repo;
        this.alerts = alerts;
    }

    public List<Map<String, Object>> list() {
        return repo.list();
    }

    public List<Map<String, Object>> create(CertificateRequest r) {
        save(UUID.randomUUID(), r, true);
        return list();
    }

    public List<Map<String, Object>> update(UUID id, CertificateRequest r) {
        save(id, r, false);
        return list();
    }

    public List<Map<String, Object>> delete(UUID id) {
        repo.delete(id);
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
        var values = new DigitalCertificateRepository.Values(subject, taxCode, blank(r.representative()), r.signatureType(),
                blank(r.provider()), serial, from, to, r.certStatus(), r.active(), p == null ? null : p.issuer(),
                p == null ? null : p.der(), id);
        if (insert) {
            repo.insert(values);
        } else {
            // không gửi file mới → giữ chứng thư đã lưu
            int n = repo.update(values);
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
