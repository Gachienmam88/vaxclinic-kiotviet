package com.vaxclinic.integration.storeprofile.dto;

import com.vaxclinic.integration.storeprofile.controller.DigitalCertificateController;
import com.vaxclinic.integration.storeprofile.dto.DigitalCertificateDtos.CertificateItem;
import com.vaxclinic.integration.storeprofile.dto.DigitalCertificateDtos.ParsedCertificate;
import org.junit.jupiter.api.Test;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.UUID;

import static com.vaxclinic.integration.JsonShape.assertSameJson;
import static com.vaxclinic.integration.JsonShape.row;

/** JSON của record mới = JSON của Map / dòng queryForList trả về trước đây (DigitalCertificateController). */
class DigitalCertificateDtosJsonTest {

    @Test
    void parse() {
        var out = new HashMap<String, Object>();
        out.put("subjectName", "CÔNG TY A");
        out.put("taxCode", null);
        out.put("provider", "VNPT-CA");
        out.put("serialNumber", "5401");
        out.put("activatedOn", LocalDate.of(2025, 1, 2));
        out.put("expiresOn", LocalDate.of(2027, 1, 2));
        out.put("issuer", null);
        out.put("certificateBase64", "AQID");
        assertSameJson(out, new ParsedCertificate("CÔNG TY A", null, "VNPT-CA", "5401", LocalDate.of(2025, 1, 2),
                LocalDate.of(2027, 1, 2), null, "AQID"));
    }

    @Test
    void listRows() {
        var full = row("id", UUID.randomUUID(), "subject_name", "CÔNG TY A", "tax_code", "0101234567",
                "representative", "Nguyễn Văn A", "signature_type", "USB_TOKEN", "provider", "VNPT-CA", "serial_number", "5401",
                "activated_on", java.sql.Date.valueOf("2025-01-02"), "expires_on", java.sql.Date.valueOf("2027-01-02"),
                "cert_status", "APPROVED", "active", true, "issuer", "CN=VNPT", "has_certificate", true,
                "updated_at", Timestamp.from(Instant.parse("2026-10-29T03:04:05.678Z")));
        var nulls = row("id", UUID.randomUUID(), "subject_name", "B", "tax_code", null, "representative", null,
                "signature_type", "HSM", "provider", null, "serial_number", null, "activated_on", null,
                "expires_on", java.sql.Date.valueOf("2026-11-30"), "cert_status", "PENDING", "active", false, "issuer", null,
                "has_certificate", false, "updated_at", Timestamp.from(Instant.parse("2026-10-29T03:04:05Z")));
        assertSameJson(List.of(full, nulls), List.of(CertificateItem.fromRow(full), CertificateItem.fromRow(nulls)));
    }
}
