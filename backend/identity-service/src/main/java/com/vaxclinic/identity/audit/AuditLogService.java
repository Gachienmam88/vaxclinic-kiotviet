package com.vaxclinic.identity.audit;

import com.vaxclinic.common.audit.AuditLogger.AuditEvent;
import com.vaxclinic.common.settings.ShopSettings;
import com.vaxclinic.common.web.PageResponse;
import com.vaxclinic.identity.audit.AuditLogRepository.AuditLogItem;
import com.vaxclinic.identity.audit.AuditLogRepository.Filter;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.time.format.DateTimeFormatter;
import java.util.List;

/** Lịch sử thao tác: nhận lô sự kiện, tra cứu phân trang, dựng file CSV (mở được bằng Excel). */
@Service
public class AuditLogService {

    private static final int MAX_PAGE = 200;
    private static final int MAX_EXPORT = 50000;

    private final AuditLogRepository repo;

    public AuditLogService(AuditLogRepository repo) {
        this.repo = repo;
    }

    public void receive(List<AuditEvent> events) {
        if (!events.isEmpty()) {
            repo.insert(events);
        }
    }

    public PageResponse<AuditLogItem> search(Filter f, int page, int size) {
        long total = repo.count(f);
        int limit = Math.min(size, MAX_PAGE);
        var items = repo.find(f, limit, (long) Math.max(page, 0) * limit);
        return new PageResponse<>(items, total, page, size);
    }

    /** CSV UTF-8 có BOM để Excel đọc đúng tiếng Việt, tối đa 50.000 dòng theo bộ lọc. */
    public byte[] exportCsv(Filter f) {
        var fmt = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss").withZone(ShopSettings.ZONE);
        var sb = new StringBuilder("﻿Nhân viên,Tính năng,Thao tác,Mã chứng từ,Thời gian,Chi tiết\n");
        repo.forEach(f, MAX_EXPORT, rs -> {
            sb.append(csv(rs.getString("user_name"))).append(',').append(csv(rs.getString("feature"))).append(',')
                    .append(csv(rs.getString("action"))).append(',').append(csv(rs.getString("doc_code"))).append(',')
                    .append(fmt.format(rs.getTimestamp("occurred_at").toInstant())).append(',')
                    .append(csv(rs.getString("detail"))).append('\n');
        });
        return sb.toString().getBytes(StandardCharsets.UTF_8);
    }

    public List<String> features() {
        return repo.features();
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
