package com.vaxclinic.identity.audit;

import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.common.audit.AuditLogger.AuditEvent;
import com.vaxclinic.common.settings.ShopSettings;
import com.vaxclinic.common.web.PageResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/** Lịch sử thao tác: nhận từ các service, tra cứu có lọc, xuất file CSV (mở được bằng Excel). */
@RestController
public class AuditLogController {

    public record AuditLogItem(long id, Instant occurredAt, UUID userId, String userName, UUID branchId, String feature,
                               String action, String docCode, String detail) {
    }

    /** identity-service tự ghi thẳng DB (không gọi HTTP vào chính mình). */
    @Component
    public static class JdbcAuditLogger implements AuditLogger {
        private static final Logger log = LoggerFactory.getLogger(JdbcAuditLogger.class);
        private final JdbcTemplate jdbc;

        public JdbcAuditLogger(JdbcTemplate jdbc) {
            this.jdbc = jdbc;
        }

        @Override
        public void record(AuditEvent e) {
            try {
                insert(jdbc, List.of(e));
            } catch (RuntimeException ex) {
                log.warn("Cannot write audit log: {}", ex.getMessage());
            }
        }
    }

    private final JdbcTemplate jdbc;

    public AuditLogController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    static void insert(JdbcTemplate jdbc, List<AuditEvent> events) {
        jdbc.batchUpdate("insert into audit_logs(occurred_at, user_id, user_name, branch_id, feature, action, doc_code, detail)"
                + " values (?,?,?,?,?,?,?,?)", events, events.size(), (ps, e) -> {
            ps.setTimestamp(1, Timestamp.from(e.occurredAt() == null ? Instant.now() : e.occurredAt()));
            ps.setObject(2, e.userId());
            ps.setString(3, cut(e.userName(), 150));
            ps.setObject(4, e.branchId());
            ps.setString(5, cut(e.feature(), 50));
            ps.setString(6, cut(e.action(), 30));
            ps.setString(7, cut(e.docCode(), 50));
            ps.setString(8, cut(e.detail(), 1000));
        });
    }

    private static String cut(String s, int max) {
        return s == null || s.length() <= max ? s : s.substring(0, max);
    }

    @PostMapping("/internal/audit-logs")
    @PreAuthorize("hasAuthority('internal')")
    public void receive(@RequestBody List<AuditEvent> events) {
        if (!events.isEmpty()) {
            insert(jdbc, events);
        }
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
        var where = where(userId, feature, from, to, q);
        Long total = jdbc.queryForObject("select count(*) from audit_logs" + where.sql, Long.class, where.args.toArray());
        var args = new ArrayList<>(where.args);
        args.add(Math.min(size, 200));
        args.add((long) Math.max(page, 0) * Math.min(size, 200));
        var items = jdbc.query("select * from audit_logs" + where.sql + " order by occurred_at desc, id desc limit ? offset ?",
                (rs, i) -> new AuditLogItem(rs.getLong("id"), rs.getTimestamp("occurred_at").toInstant(),
                        rs.getObject("user_id", UUID.class), rs.getString("user_name"), rs.getObject("branch_id", UUID.class),
                        rs.getString("feature"), rs.getString("action"), rs.getString("doc_code"), rs.getString("detail")),
                args.toArray());
        return new PageResponse<>(items, total == null ? 0 : total, page, size);
    }

    /** Xuất CSV (UTF-8 có BOM để Excel đọc đúng tiếng Việt), tối đa 50.000 dòng theo bộ lọc. */
    @GetMapping("/api/audit-logs/export")
    @PreAuthorize("hasAuthority('user.manage')")
    public ResponseEntity<byte[]> export(@RequestParam(required = false) UUID userId,
                                         @RequestParam(required = false) String feature,
                                         @RequestParam(required = false) LocalDate from,
                                         @RequestParam(required = false) LocalDate to,
                                         @RequestParam(defaultValue = "") String q) {
        var where = where(userId, feature, from, to, q);
        var fmt = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss").withZone(ShopSettings.ZONE);
        var sb = new StringBuilder("﻿Nhân viên,Tính năng,Thao tác,Mã chứng từ,Thời gian,Chi tiết\n");
        jdbc.query("select * from audit_logs" + where.sql + " order by occurred_at desc limit 50000", rs -> {
            sb.append(csv(rs.getString("user_name"))).append(',').append(csv(rs.getString("feature"))).append(',')
                    .append(csv(rs.getString("action"))).append(',').append(csv(rs.getString("doc_code"))).append(',')
                    .append(fmt.format(rs.getTimestamp("occurred_at").toInstant())).append(',')
                    .append(csv(rs.getString("detail"))).append('\n');
        }, where.args.toArray());
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"lich-su-thao-tac.csv\"")
                .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                .body(sb.toString().getBytes(StandardCharsets.UTF_8));
    }

    @GetMapping("/api/audit-logs/features")
    @PreAuthorize("hasAuthority('user.manage')")
    public List<String> features() {
        return jdbc.queryForList("select distinct feature from audit_logs order by feature", String.class);
    }

    private record Where(String sql, List<Object> args) {
    }

    private static Where where(UUID userId, String feature, LocalDate from, LocalDate to, String q) {
        var sql = new StringBuilder(" where 1=1");
        var args = new ArrayList<Object>();
        if (userId != null) {
            sql.append(" and user_id = ?");
            args.add(userId);
        }
        if (feature != null && !feature.isBlank()) {
            sql.append(" and feature = ?");
            args.add(feature);
        }
        if (from != null) {
            sql.append(" and occurred_at >= ?");
            args.add(Timestamp.from(from.atStartOfDay(ShopSettings.ZONE).toInstant()));
        }
        if (to != null) {
            sql.append(" and occurred_at < ?");
            args.add(Timestamp.from(to.plusDays(1).atStartOfDay(ShopSettings.ZONE).toInstant()));
        }
        if (!q.isBlank()) {
            sql.append(" and (doc_code ilike ? or detail ilike ?)");
            String like = "%" + q.trim().replace("%", "\\%").replace("_", "\\_") + "%";
            args.add(like);
            args.add(like);
        }
        return new Where(sql.toString(), args);
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
