package com.vaxclinic.integration.storeprofile;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Bảng digital_certificates (chữ ký số của cửa hàng). Chỉ truy cập DB. */
@Repository
public class DigitalCertificateRepository {

    /** Dữ liệu ghi xuống; issuer / der null khi không kèm file chứng thư. */
    public record CertificateRow(String subjectName, String taxCode, String representative, String signatureType, String provider,
                                 String serialNumber, LocalDate activatedOn, LocalDate expiresOn, String certStatus, boolean active,
                                 String issuer, byte[] der) {
    }

    /** Chữ ký số cần cảnh báo hết hạn. */
    public record ExpiringCertificate(UUID id, String subjectName, String serialNumber, LocalDate expiresOn) {
    }

    private static final String COLUMNS = "id, subject_name, tax_code, representative, signature_type, provider, serial_number,"
            + " activated_on, expires_on, cert_status, active, issuer, cert_der is not null as has_certificate, updated_at";

    private final JdbcTemplate jdbc;

    public DigitalCertificateRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<Map<String, Object>> findAll() {
        return jdbc.queryForList("select " + COLUMNS + " from digital_certificates order by expires_on desc, subject_name");
    }

    public void insert(UUID id, CertificateRow c) {
        jdbc.update("insert into digital_certificates(subject_name, tax_code, representative, signature_type, provider, serial_number,"
                + " activated_on, expires_on, cert_status, active, issuer, cert_der, id) values (?,?,?,?,?,?,?,?,?,?,?,?,?)", args(c, id));
    }

    /** Không gửi file mới (issuer / der null) → giữ chứng thư đã lưu. Trả số dòng đã sửa. */
    public int update(UUID id, CertificateRow c) {
        return jdbc.update("update digital_certificates set subject_name = ?, tax_code = ?, representative = ?, signature_type = ?,"
                + " provider = ?, serial_number = ?, activated_on = ?, expires_on = ?, cert_status = ?, active = ?,"
                + " issuer = coalesce(?, issuer), cert_der = coalesce(?, cert_der), updated_at = now() where id = ?", args(c, id));
    }

    public void delete(UUID id) {
        jdbc.update("delete from digital_certificates where id = ?", id);
    }

    /** Đang hoạt động, chưa thu hồi, hết hạn trước hoặc đúng ngày {@code until}; hạn gần nhất trước. */
    public List<ExpiringCertificate> findActiveExpiringBy(LocalDate until) {
        return jdbc.query("""
                select id, subject_name, serial_number, expires_on from digital_certificates
                where active and cert_status <> 'REVOKED' and expires_on <= ? order by expires_on""",
                (rs, i) -> new ExpiringCertificate(rs.getObject("id", UUID.class), rs.getString("subject_name"),
                        rs.getString("serial_number"), rs.getObject("expires_on", LocalDate.class)), until);
    }

    private static Object[] args(CertificateRow c, UUID id) {
        return new Object[]{c.subjectName(), c.taxCode(), c.representative(), c.signatureType(), c.provider(), c.serialNumber(),
                c.activatedOn(), c.expiresOn(), c.certStatus(), c.active(), c.issuer(), c.der(), id};
    }
}
