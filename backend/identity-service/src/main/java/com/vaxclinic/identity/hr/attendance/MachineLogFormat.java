package com.vaxclinic.identity.hr.attendance;

import com.vaxclinic.common.settings.ShopSettings;

import java.text.Normalizer;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.List;

/** Đọc file log máy chấm công: nhận diện cột theo tiêu đề, đọc thời gian nhiều định dạng (kể cả số ngày Excel, AM/PM, SA/CH). */
final class MachineLogFormat {

    private static final List<DateTimeFormatter> FORMATS = List.of(
            "d/M/yyyy H:mm:ss", "d/M/yyyy H:mm", "yyyy-M-d H:mm:ss", "yyyy-M-d H:mm", "yyyy/M/d H:mm:ss", "yyyy/M/d H:mm",
            "d-M-yyyy H:mm:ss", "d-M-yyyy H:mm", "yyyy-M-d'T'H:mm:ss", "yyyy-M-d'T'H:mm").stream().map(DateTimeFormatter::ofPattern).toList();

    private MachineLogFormat() {
    }

    /** [cột mã, cột thời gian/ngày, cột giờ (-1 nếu gộp), có dòng tiêu đề (1/0)]. Không nhận ra tiêu đề → cột 0 = mã, cột 1 = thời gian. */
    static int[] columns(List<String> head) {
        int code = -1, dt = -1, date = -1, time = -1;
        for (int i = 0; i < head.size(); i++) {
            String h = norm(head.get(i));
            if (code < 0 && (h.contains("cham cong") || h.contains("ac-no") || h.contains("enroll") || h.equals("id") || h.contains("user id")
                    || h.contains("ma nv") || h.contains("no."))) {
                code = i;
            } else if (dt < 0 && (h.contains("thoi gian") || h.contains("datetime") || h.contains("ngay gio") || h.equals("time") && date < 0
                    || h.contains("check time"))) {
                dt = i;
            } else if (date < 0 && (h.equals("ngay") || h.equals("date"))) {
                date = i;
            } else if (time < 0 && (h.equals("gio") || h.equals("time") || h.equals("thoi diem"))) {
                time = i;
            }
        }
        if (date >= 0 && time >= 0) {
            return new int[]{Math.max(code, 0), date, time, code >= 0 ? 1 : 0};
        }
        if (code >= 0 && (dt >= 0 || date >= 0)) {
            return new int[]{code, dt >= 0 ? dt : date, -1, 1};
        }
        return new int[]{0, 1, -1, 0};
    }

    static Instant parse(String s) {
        String v = s.trim().replaceAll("\\s+", " ");
        if (v.isEmpty()) {
            return null;
        }
        if (v.matches("\\d+(\\.\\d+)?")) { // ô ngày giờ Excel dạng số (ngày kể từ 30/12/1899)
            double d = Double.parseDouble(v);
            long secs = Math.round((d - 25569) * 86400);
            return LocalDateTime.ofEpochSecond(secs, 0, ZoneOffset.UTC).atZone(ShopSettings.ZONE).toInstant();
        }
        String up = v.toUpperCase();
        boolean pm = up.endsWith(" PM") || up.endsWith(" CH"); // CH = chiều, SA = sáng (Windows tiếng Việt)
        boolean ampm = pm || up.endsWith(" AM") || up.endsWith(" SA");
        if (ampm) {
            v = v.substring(0, v.length() - 3).trim();
        }
        for (DateTimeFormatter f : FORMATS) {
            try {
                LocalDateTime t = LocalDateTime.parse(v, f);
                if (ampm && pm && t.getHour() < 12) {
                    t = t.plusHours(12);
                } else if (ampm && !pm && t.getHour() == 12) {
                    t = t.minusHours(12);
                }
                return t.atZone(ShopSettings.ZONE).toInstant();
            } catch (DateTimeParseException ignored) {
                // thử định dạng kế tiếp
            }
        }
        return null;
    }

    /** Máy thường xuất "00012" cho mã 12. */
    static String stripZeros(String code) {
        return code.replaceFirst("^0+(?=.)", "");
    }

    static String cell(List<String> r, int i) {
        return i >= 0 && i < r.size() && r.get(i) != null ? r.get(i).trim() : "";
    }

    private static String norm(String s) {
        return Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}", "").replace('đ', 'd').replace('Đ', 'D')
                .toLowerCase().trim();
    }
}
