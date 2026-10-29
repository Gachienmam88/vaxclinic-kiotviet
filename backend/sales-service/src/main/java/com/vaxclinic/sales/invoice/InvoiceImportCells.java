package com.vaxclinic.sales.invoice;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.format.ResolverStyle;
import java.time.Instant;
import java.util.regex.Pattern;

/** Đọc ô chữ của file import: số kiểu Việt Nam / quốc tế, ngày dd/MM/yyyy [HH:mm[:ss]] theo giờ Việt Nam. */
final class InvoiceImportCells {

    static final ZoneId VN = ZoneId.of("Asia/Ho_Chi_Minh");
    /** Ô sai định dạng (khác ô trống = null). */
    static final BigDecimal INVALID = new BigDecimal("-999999999999");

    private static final Pattern US_THOUSANDS = Pattern.compile("^-?\\d{1,3}(,\\d{3})+(\\.\\d+)?$");
    private static final Pattern VN_THOUSANDS = Pattern.compile("^-?\\d{1,3}(\\.\\d{3})+(,\\d+)?$");
    private static final Pattern PLAIN = Pattern.compile("^-?\\d+([.,]\\d+)?$");
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("d/M/uuuu").withResolverStyle(ResolverStyle.STRICT);
    private static final DateTimeFormatter MINUTE = DateTimeFormatter.ofPattern("d/M/uuuu H:mm").withResolverStyle(ResolverStyle.STRICT);
    private static final DateTimeFormatter SECOND = DateTimeFormatter.ofPattern("d/M/uuuu H:mm:ss").withResolverStyle(ResolverStyle.STRICT);

    private InvoiceImportCells() {
    }

    static String text(String v) {
        return v == null ? "" : v.trim();
    }

    static boolean blank(String v) {
        return v == null || v.isBlank();
    }

    /** Ô trống → null; sai → {@link #INVALID}. "100,000" / "100.000" / "100000" / "12,5" đều đọc được. */
    static BigDecimal number(String v) {
        String s = text(v).replace(" ", "");
        if (s.isEmpty()) {
            return null;
        }
        if (US_THOUSANDS.matcher(s).matches()) {
            return new BigDecimal(s.replace(",", ""));
        }
        if (VN_THOUSANDS.matcher(s).matches()) {
            return new BigDecimal(s.replace(".", "").replace(",", "."));
        }
        return PLAIN.matcher(s).matches() ? new BigDecimal(s.replace(",", ".")) : INVALID;
    }

    static boolean invalid(BigDecimal v) {
        return v == INVALID;
    }

    /** dd/MM/yyyy (00:00) hoặc dd/MM/yyyy HH:mm[:ss]; sai → null. */
    static Instant dateTime(String v) {
        String s = text(v).replaceAll("\\s+", " ");
        for (DateTimeFormatter f : new DateTimeFormatter[] {SECOND, MINUTE}) {
            try {
                return LocalDateTime.parse(s, f).atZone(VN).toInstant();
            } catch (DateTimeParseException ignored) {
                // thử định dạng khác
            }
        }
        LocalDate d = date(s);
        return d == null ? null : d.atStartOfDay(VN).toInstant();
    }

    static LocalDate date(String v) {
        try {
            return LocalDate.parse(text(v), DATE);
        } catch (DateTimeParseException e) {
            return null;
        }
    }
}
