package com.vaxclinic.identity.audit.controller;

import com.vaxclinic.identity.audit.dto.AuditLogItem;
import com.vaxclinic.identity.audit.service.AuditLogService;
import com.vaxclinic.common.audit.AuditLogger.AuditEvent;
import com.vaxclinic.common.web.PageResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Lịch sử thao tác: nhận từ các service, tra cứu có lọc, xuất file CSV (mở được bằng Excel). */
@RestController
public class AuditLogController {

    private final AuditLogService service;

    public AuditLogController(AuditLogService service) {
        this.service = service;
    }

    @PostMapping("/internal/audit-logs")
    @PreAuthorize("hasAuthority('internal')")
    public void receive(@RequestBody List<AuditEvent> events) {
        service.receive(events);
    }

    @GetMapping("/api/audit-logs")
    @PreAuthorize("hasAuthority('user.manage')")
    public PageResponse<AuditLogItem> search(@RequestParam(required = false) UUID userId,
                                             @RequestParam(required = false) String feature,
                                             @RequestParam(required = false) LocalDate from,
                                             @RequestParam(required = false) LocalDate to,
                                             @RequestParam(defaultValue = "") String q,
                                             @RequestParam(defaultValue = "0") int page,
                                             @RequestParam(defaultValue = "20") int size) {
        return service.search(userId, feature, from, to, q, page, size);
    }

    /** Xuất CSV (UTF-8 có BOM để Excel đọc đúng tiếng Việt), tối đa 50.000 dòng theo bộ lọc. */
    @GetMapping("/api/audit-logs/export")
    @PreAuthorize("hasAuthority('user.manage')")
    public ResponseEntity<byte[]> export(@RequestParam(required = false) UUID userId,
                                         @RequestParam(required = false) String feature,
                                         @RequestParam(required = false) LocalDate from,
                                         @RequestParam(required = false) LocalDate to,
                                         @RequestParam(defaultValue = "") String q) {
        String csv = service.exportCsv(userId, feature, from, to, q);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"lich-su-thao-tac.csv\"")
                .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                .body(csv.getBytes(StandardCharsets.UTF_8));
    }

    @GetMapping("/api/audit-logs/features")
    @PreAuthorize("hasAuthority('user.manage')")
    public List<String> features() {
        return service.features();
    }
}
