package com.vaxclinic.integration.storeprofile;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.common.settings.ShopSettings;

import javax.naming.InvalidNameException;
import javax.naming.ldap.LdapName;
import javax.naming.ldap.Rdn;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.security.cert.CertificateException;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.time.LocalDate;
import java.util.Base64;
import java.util.HexFormat;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Đọc chứng thư số công khai (.cer/.crt, DER hoặc PEM) bằng CertificateFactory X.509 → chủ thể, MST, serial, hiệu lực.
 * Không bao giờ nhận khóa bí mật: file có "PRIVATE KEY" hoặc không phải chứng thư X.509 (VD .pfx/.p12) bị từ chối.
 * CA Việt Nam ghi MST trong thuộc tính UID của chủ thể dạng "MST:0123456789" (hoặc "MST:0123456789-001").
 */
public final class CertificateFileParser {

    public record Parsed(String subjectName, String taxCode, String provider, String serialNumber, LocalDate activatedOn,
                         LocalDate expiresOn, String issuer, byte[] der) {
    }

    static final int MAX_BYTES = 20_000;
    private static final Pattern MST = Pattern.compile("MST[:=]\\s*(\\d{10}(?:-\\d{3})?)");

    private CertificateFileParser() {
    }

    public static Parsed parse(byte[] file) {
        if (file == null || file.length == 0 || file.length > MAX_BYTES) {
            throw BusinessException.badRequest("INVALID_CERTIFICATE", "File chứng thư số trống hoặc quá lớn (tối đa 20KB)");
        }
        String text = new String(file, StandardCharsets.US_ASCII);
        if (text.contains("PRIVATE KEY")) {
            throw BusinessException.badRequest("PRIVATE_KEY_REJECTED",
                    "File chứa khóa bí mật — tuyệt đối không tải khóa bí mật lên. Chỉ dùng file chứng thư công khai (.cer)");
        }
        try {
            var cert = (X509Certificate) CertificateFactory.getInstance("X.509").generateCertificate(new ByteArrayInputStream(file));
            String subject = cert.getSubjectX500Principal().getName();
            String issuer = cert.getIssuerX500Principal().getName();
            Matcher m = MST.matcher(cert.getSubjectX500Principal().toString() + "," + subject);
            return new Parsed(attr(subject, "CN"), m.find() ? m.group(1) : null, attr(issuer, "CN"),
                    HexFormat.of().withUpperCase().formatHex(cert.getSerialNumber().toByteArray()).replaceFirst("^00(?=.)", ""),
                    LocalDate.ofInstant(cert.getNotBefore().toInstant(), ShopSettings.ZONE),
                    LocalDate.ofInstant(cert.getNotAfter().toInstant(), ShopSettings.ZONE),
                    cut(cert.getIssuerX500Principal().toString(), 500), cert.getEncoded());
        } catch (CertificateException | ClassCastException e) {
            throw BusinessException.badRequest("INVALID_CERTIFICATE",
                    "Không đọc được chứng thư số. Dùng file chứng thư công khai .cer/.crt (DER hoặc PEM)");
        }
    }

    public static Parsed parseBase64(String b64) {
        try {
            return parse(Base64.getDecoder().decode(b64));
        } catch (IllegalArgumentException e) {
            throw BusinessException.badRequest("INVALID_CERTIFICATE", "Dữ liệu chứng thư số không hợp lệ");
        }
    }

    /** Giá trị đầu tiên của thuộc tính (CN, O...) trong tên X.500 dạng RFC 2253. */
    private static String attr(String rfc2253, String type) {
        try {
            for (Rdn rdn : new LdapName(rfc2253).getRdns()) {
                if (rdn.getType().equalsIgnoreCase(type)) {
                    return rdn.getValue().toString();
                }
            }
        } catch (InvalidNameException ignored) {
            // tên không chuẩn → không lấy được thuộc tính
        }
        return null;
    }

    private static String cut(String s, int max) {
        return s == null || s.length() <= max ? s : s.substring(0, max);
    }
}
