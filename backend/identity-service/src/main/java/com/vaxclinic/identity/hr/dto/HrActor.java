package com.vaxclinic.identity.hr.dto;

import com.vaxclinic.common.audit.AuditLogger;
import org.springframework.security.oauth2.jwt.Jwt;

import java.math.BigDecimal;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.util.Locale;
import java.util.UUID;

/** Người thao tác (từ JWT) + ghi Lịch sử thao tác cho các màn Nhân viên. */
public record HrActor(UUID id, String name) {

    public static final String FEATURE = "Nhân viên";

    public static HrActor of(Jwt jwt) {
        return new HrActor(UUID.fromString(jwt.getSubject()), jwt.getClaimAsString("name"));
    }

    public void audit(AuditLogger audit, String feature, String action, String docCode, String detail) {
        audit.record(id, name, null, feature, action, docCode, detail);
    }

    public void audit(AuditLogger audit, String action, String detail) {
        audit(audit, FEATURE, action, null, detail);
    }

    /** 1500000 → "1,500,000". */
    public static String money(BigDecimal v) {
        return new DecimalFormat("#,##0", DecimalFormatSymbols.getInstance(Locale.US)).format(v == null ? BigDecimal.ZERO : v);
    }

    public static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
