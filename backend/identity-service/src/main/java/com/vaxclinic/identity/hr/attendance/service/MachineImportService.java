package com.vaxclinic.identity.hr.attendance.service;

import com.vaxclinic.identity.hr.attendance.repository.AttendanceRepository;
import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.common.settings.ShopSettings;
import com.vaxclinic.identity.hr.dto.HrActor;
import com.vaxclinic.identity.hr.attendance.dto.AttendanceDtos.ImportResult;
import com.vaxclinic.identity.hr.attendance.service.AttendanceWriter.Slot;
import com.vaxclinic.identity.hr.settings.service.HrSettingsService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.text.Normalizer;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Máy chấm công: nhập file log xuất từ máy vân tay / khuôn mặt (CSV, TXT, XLSX) gồm cột Mã chấm công + Thời gian
 * (hoặc Ngày + Giờ tách riêng). Mỗi lần quét được ghép vào ca phù hợp; trong 1 ca: giờ vào = sớm nhất, giờ ra = muộn nhất.
 */
@Service
public class MachineImportService {

    private static final List<DateTimeFormatter> FORMATS = List.of(
            "d/M/yyyy H:mm:ss", "d/M/yyyy H:mm", "yyyy-M-d H:mm:ss", "yyyy-M-d H:mm", "yyyy/M/d H:mm:ss", "yyyy/M/d H:mm",
            "d-M-yyyy H:mm:ss", "d-M-yyyy H:mm", "yyyy-M-d'T'H:mm:ss", "yyyy-M-d'T'H:mm").stream().map(DateTimeFormatter::ofPattern).toList();

    private final AttendanceRepository attendance;
    private final AttendanceWriter writer;
    private final HrSettingsService settings;
    private final AuditLogger audit;

    public MachineImportService(AttendanceRepository attendance, AttendanceWriter writer, HrSettingsService settings, AuditLogger audit) {
        this.attendance = attendance;
        this.writer = writer;
        this.settings = settings;
        this.audit = audit;
    }

    @Transactional
    public ImportResult importFile(MultipartFile file, UUID branchId, HrActor actor) throws IOException {
        if (file.isEmpty()) {
            throw BusinessException.badRequest("EMPTY_FILE", "Chọn file dữ liệu chấm công");
        }
        List<List<String>> rows = SpreadsheetReader.read(file.getOriginalFilename(), file.getBytes());
        if (rows.isEmpty()) {
            throw BusinessException.badRequest("EMPTY_FILE", "File không có dữ liệu");
        }
        int[] cols = columns(rows.get(0));
        boolean header = cols[3] == 1;
        Map<String, UUID> employees = new HashMap<>();
        for (var c : attendance.workingTimekeepingCodes()) {
            employees.put(stripZeros(c.code().trim().toUpperCase()), c.employeeId());
        }
        boolean unscheduled = settings.timekeeping().allowUnscheduled();
        Set<String> unknown = new LinkedHashSet<>();
        List<String> errors = new ArrayList<>();
        // (nhân viên, ca, ngày) → [giờ sớm nhất, giờ muộn nhất, số lượt]
        Map<String, Object[]> groups = new LinkedHashMap<>();
        int punches = 0;
        int unmatched = 0;
        for (int i = header ? 1 : 0; i < rows.size(); i++) {
            List<String> r = rows.get(i);
            String code = cell(r, cols[0]).toUpperCase();
            if (code.isEmpty()) {
                continue;
            }
            Instant at = parse(cols[2] >= 0 ? cell(r, cols[1]) + " " + cell(r, cols[2]) : cell(r, cols[1]));
            if (at == null) {
                if (errors.size() < 20) {
                    errors.add("Dòng " + (i + 1) + ": thời gian không hợp lệ \"" + cell(r, cols[1]) + "\"");
                }
                continue;
            }
            UUID emp = employees.get(stripZeros(code)); // máy thường xuất "00012" cho mã 12
            if (emp == null) {
                unknown.add(code);
                continue;
            }
            punches++;
            Slot slot = writer.pick(emp, at, unscheduled);
            if (slot == null) {
                unmatched++;
                continue;
            }
            Object[] g = groups.computeIfAbsent(emp + "|" + slot.shift().id() + "|" + slot.date(), k -> new Object[]{slot, emp, at, at, 0});
            if (at.isBefore((Instant) g[2])) {
                g[2] = at;
            }
            if (at.isAfter((Instant) g[3])) {
                g[3] = at;
            }
            g[4] = (int) g[4] + 1;
        }
        int records = 0;
        for (Object[] g : groups.values()) {
            Slot slot = (Slot) g[0];
            Instant first = (Instant) g[2];
            Instant last = (Instant) g[3];
            boolean single = (int) g[4] == 1 || !last.isAfter(first.plusSeconds(60));
            // 1 lượt quét: gần giờ bắt đầu ca → giờ vào, gần giờ kết thúc → giờ ra
            boolean asIn = !single || java.time.Duration.between(slot.start(), first).abs()
                    .compareTo(java.time.Duration.between(slot.end(), first).abs()) <= 0;
            if (writer.merge(slot, (UUID) g[1], asIn ? first : null, single ? (asIn ? null : first) : last, "MACHINE", branchId)) {
                records++;
            }
        }
        actor.audit(audit, "Import", "Nhập file máy chấm công " + file.getOriginalFilename() + ": " + punches
                + " lượt quét, " + records + " lượt chấm công");
        return new ImportResult(rows.size() - (header ? 1 : 0), punches, records, List.copyOf(unknown), unmatched, errors);
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
            return LocalDateTime.ofEpochSecond(secs, 0, java.time.ZoneOffset.UTC).atZone(ShopSettings.ZONE).toInstant();
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

    private static String stripZeros(String code) {
        return code.replaceFirst("^0+(?=.)", "");
    }

    private static String cell(List<String> r, int i) {
        return i >= 0 && i < r.size() && r.get(i) != null ? r.get(i).trim() : "";
    }

    private static String norm(String s) {
        return Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}", "").replace('đ', 'd').replace('Đ', 'D')
                .toLowerCase().trim();
    }
}
