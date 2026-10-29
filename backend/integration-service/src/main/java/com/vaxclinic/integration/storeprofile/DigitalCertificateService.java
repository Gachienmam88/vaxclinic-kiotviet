package com.vaxclinic.integration.storeprofile;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.integration.storeprofile.CertificateFileParser.Parsed;
import com.vaxclinic.integration.storeprofile.DigitalCertificateRepository.CertificateRow;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Hồ sơ cửa hàng → Quản lý chữ ký số. Có file chứng thư (.cer) thì chủ thể / MST / serial / hiệu lực lấy theo file
 * (nguồn đáng tin hơn nhập tay). Sau mỗi thay đổi đồng bộ cảnh báo "sắp hết hạn" vào Hộp thư đến.
 */
@Service
public class DigitalCertificateService {

    private final DigitalCertificateRepository certificates;
    private final CertificateExpiryAlerts alerts;

    public DigitalCertificateService(DigitalCertificateRepository certificates, CertificateExpiryAlerts alerts) {
        this.certificates = certificates;
        this.alerts = alerts;
    }

    public List<Map<String, Object>> list() {
        return certificates.findAll();
    }

    /** Đọc file .cer để điền sẵn form; không lưu gì. */
    public Map<String, Object> parse(byte[] file) {
        Parsed p = CertificateFileParser.parse(file);
        var out = new HashMap<String, Object>();
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

    public List<Map<String, Object>> create(DigitalCertificateController.CertificateRequest r) {
        certificates.insert(UUID.randomUUID(), toRow(r));
        alerts.syncQuietly();
        return list();
    }

    public List<Map<String, Object>> update(UUID id, DigitalCertificateController.CertificateRequest r) {
        if (certificates.update(id, toRow(r)) == 0) {
            throw BusinessException.notFound("CERT_NOT_FOUND", "Không tìm thấy chữ ký số");
        }
        alerts.syncQuietly();
        return list();
    }

    public List<Map<String, Object>> delete(UUID id) {
        certificates.delete(id);
        alerts.syncQuietly();
        return list();
    }

    private static CertificateRow toRow(DigitalCertificateController.CertificateRequest r) {
        Parsed p = r.certificateBase64() == null || r.certificateBase64().isBlank() ? null : CertificateFileParser.parseBase64(r.certificateBase64());
        String subject = p != null && p.subjectName() != null ? p.subjectName() : r.subjectName().trim();
        String taxCode = p != null && p.taxCode() != null ? p.taxCode() : blank(r.taxCode());
        String serial = p != null ? p.serialNumber() : blank(r.serialNumber());
        LocalDate from = p != null ? p.activatedOn() : r.activatedOn();
        LocalDate to = p != null ? p.expiresOn() : r.expiresOn();
        if (from != null && to.isBefore(from)) {
            throw BusinessException.badRequest("INVALID_CERT_DATES", "Ngày hết hạn phải sau ngày kích hoạt");
        }
        return new CertificateRow(subject, taxCode, blank(r.representative()), r.signatureType(), blank(r.provider()), serial, from, to,
                r.certStatus(), r.active(), p == null ? null : p.issuer(), p == null ? null : p.der());
    }

    private static String blank(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
