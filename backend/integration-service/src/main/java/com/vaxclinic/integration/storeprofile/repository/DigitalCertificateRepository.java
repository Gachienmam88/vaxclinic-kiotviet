package com.vaxclinic.integration.storeprofile.repository;

import com.vaxclinic.integration.storeprofile.dto.DigitalCertificateDtos.CertificateItem;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** digital_certificates (chỉ chứng thư công khai, không bao giờ lưu khóa bí mật). */
@Repository
public class DigitalCertificateRepository {

    private static final String COLUMNS = "id, subject_name, tax_code, representative, signature_type, provider, serial_number,"
            + " activated_on, expires_on, cert_status, active, issuer, cert_der is not null as has_certificate, updated_at";

    /** Giá trị ghi vào 1 dòng; issuer / der null khi không gửi file chứng thư. */
    public record Values(String subjectName, String taxCode, String representative, String signatureType, String provider,
                         String serialNumber, LocalDate activatedOn, LocalDate expiresOn, String certStatus, boolean active,
                         String issuer, byte[] der, UUID id) {

        Object[] args() {
            return new Object[]{subjectName, taxCode, representative, signatureType, provider, serialNumber, activatedOn,
                    expiresOn, certStatus, active, issuer, der, id};
        }
    }

    private final JdbcTemplate jdbc;

    public DigitalCertificateRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<CertificateItem> list() {
        return jdbc.queryForList("select " + COLUMNS + " from digital_certificates order by expires_on desc, subject_name")
                .stream().map(CertificateItem::fromRow).toList();
    }

    public void insert(Values v) {
        jdbc.update("insert into digital_certificates(subject_name, tax_code, representative, signature_type, provider, serial_number,"
                + " activated_on, expires_on, cert_status, active, issuer, cert_der, id) values (?,?,?,?,?,?,?,?,?,?,?,?,?)", v.args());
    }

    /** Không gửi file mới (issuer / der null) → giữ chứng thư đã lưu. @return số dòng cập nhật */
    public int update(Values v) {
        return jdbc.update("update digital_certificates set subject_name = ?, tax_code = ?, representative = ?, signature_type = ?,"
                + " provider = ?, serial_number = ?, activated_on = ?, expires_on = ?, cert_status = ?, active = ?,"
                + " issuer = coalesce(?, issuer), cert_der = coalesce(?, cert_der), updated_at = now() where id = ?", v.args());
    }

    public void delete(UUID id) {
        jdbc.update("delete from digital_certificates where id = ?", id);
    }
}
