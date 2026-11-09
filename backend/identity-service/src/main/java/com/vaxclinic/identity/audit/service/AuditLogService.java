package com.vaxclinic.identity.audit.service;

import com.vaxclinic.identity.audit.dto.AuditLogItem;
import com.vaxclinic.identity.audit.repository.AuditLogRepository;
import com.vaxclinic.common.audit.AuditLogger.AuditEvent;
import com.vaxclinic.common.settings.ShopSettings;
import com.vaxclinic.common.web.PageResponse;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

/** Lịch sử thao tác: nhận từ các service, tra cứu có lọc, dựng nội dung CSV (mở được bằng Excel). */
@Service
public class AuditLogService {

    private final AuditLogRepository logs;

    public AuditLogService(AuditLogRepository logs) {
        this.logs = logs;
    }

    public void receive(List<AuditEvent> events) {
        if (!events.isEmpty()) {
            logs.insert(events);
        }
    }

    public PageResponse<AuditLogItem> search(UUID userId, String feature, LocalDate from, LocalDate to, String q, int page, int size) {
        var where = AuditLogRepository.where(userId, feature, from, to, q);
        Long total = logs.count(where);
        var items = logs.search(where, Math.min(size, 200), (long) Math.max(page, 0) * Math.min(size, 200));
        return new PageResponse<>(items, total == null ? 0 : total, page, size);
    }

    /** CSV (bắt đầu bằng BOM để Excel đọc đúng tiếng Việt), tối đa 50.000 dòng theo bộ lọc. */
    public String exportCsv(UUID userId, String feature, LocalDate from, LocalDate to, String q) {
        var where = AuditLogRepository.where(userId, feature, from, to, q);
        var fmt = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss").withZone(ShopSettings.ZONE);
        var sb = new StringBuilder("﻿Nhân viên,Tính năng,Thao tác,Mã chứng từ,Thời gian,Chi tiết\n");
        logs.export(where, r -> sb.append(csv(r.userName())).append(',').append(csv(r.feature())).append(',')
                .append(csv(r.action())).append(',').append(csv(r.docCode())).append(',')
                .append(fmt.format(r.occurredAt())).append(',')
                .append(csv(r.detail())).append('\n'));
        return sb.toString();
    }

    public List<String> features() {
        return logs.features();
    }

    /** Ô CSV: bọc nháy kép; chặn công thức Excel (=, +, -, @) để tránh CSV injection. */
    private static String csv(String s) {
        if (s == null) {
            return "";
        }
        String v = s.matches("^[=+\\-@].*") ? "'" + s : s;
        return '"' + v.replace("\"", "\"\"") + '"';
    }
}
