package com.vaxclinic.identity.hr.attendance;

import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.identity.hr.HrActor;
import com.vaxclinic.identity.hr.attendance.AttendanceWriter.Slot;
import com.vaxclinic.identity.hr.employee.EmployeeRepository;
import com.vaxclinic.identity.hr.settings.HrSettingsService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static com.vaxclinic.identity.hr.attendance.MachineLogFormat.cell;
import static com.vaxclinic.identity.hr.attendance.MachineLogFormat.stripZeros;

/**
 * Nhập file log máy chấm công: mỗi lần quét ghép vào ca phù hợp ({@link AttendanceWriter#pick}); trong 1 ca giờ vào = sớm nhất,
 * giờ ra = muộn nhất. Mã chấm công so khớp bỏ số 0 đầu. Ghi Lịch sử thao tác.
 */
@Service
public class MachineImportService {

    public record ImportResult(int rows, int punches, int records, List<String> unknownCodes, int unmatched, List<String> errors) {
    }

    private final EmployeeRepository employees;
    private final AttendanceWriter writer;
    private final HrSettingsService settings;
    private final AuditLogger audit;

    public MachineImportService(EmployeeRepository employees, AttendanceWriter writer, HrSettingsService settings, AuditLogger audit) {
        this.employees = employees;
        this.writer = writer;
        this.settings = settings;
        this.audit = audit;
    }

    @Transactional
    public ImportResult importFile(String filename, byte[] content, UUID branchId, HrActor actor) throws IOException {
        if (content.length == 0) {
            throw BusinessException.badRequest("EMPTY_FILE", "Chọn file dữ liệu chấm công");
        }
        List<List<String>> rows = SpreadsheetReader.read(filename, content);
        if (rows.isEmpty()) {
            throw BusinessException.badRequest("EMPTY_FILE", "File không có dữ liệu");
        }
        int[] cols = MachineLogFormat.columns(rows.get(0));
        boolean header = cols[3] == 1;
        Map<String, UUID> codes = new HashMap<>();
        employees.workingTimekeepingCodes().forEach(c -> codes.put(stripZeros(c.code().trim().toUpperCase()), c.employeeId()));
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
            Instant at = MachineLogFormat.parse(cols[2] >= 0 ? cell(r, cols[1]) + " " + cell(r, cols[2]) : cell(r, cols[1]));
            if (at == null) {
                if (errors.size() < 20) {
                    errors.add("Dòng " + (i + 1) + ": thời gian không hợp lệ \"" + cell(r, cols[1]) + "\"");
                }
                continue;
            }
            UUID emp = codes.get(stripZeros(code));
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
            boolean asIn = !single || Duration.between(slot.start(), first).abs()
                    .compareTo(Duration.between(slot.end(), first).abs()) <= 0;
            if (writer.merge(slot, (UUID) g[1], asIn ? first : null, single ? (asIn ? null : first) : last, "MACHINE", branchId)) {
                records++;
            }
        }
        actor.audit(audit, "Import", "Nhập file máy chấm công " + filename + ": " + punches
                + " lượt quét, " + records + " lượt chấm công");
        return new ImportResult(rows.size() - (header ? 1 : 0), punches, records, List.copyOf(unknown), unmatched, errors);
    }
}
