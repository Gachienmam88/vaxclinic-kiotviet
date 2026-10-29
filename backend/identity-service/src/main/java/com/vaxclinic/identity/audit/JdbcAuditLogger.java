package com.vaxclinic.identity.audit;

import com.vaxclinic.common.audit.AuditLogger;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.List;

/** identity-service tự ghi thẳng DB (không gọi HTTP vào chính mình). Lỗi ghi chỉ log cảnh báo. */
@Component
public class JdbcAuditLogger implements AuditLogger {

    private static final Logger log = LoggerFactory.getLogger(JdbcAuditLogger.class);
    private final AuditLogRepository repo;

    public JdbcAuditLogger(AuditLogRepository repo) {
        this.repo = repo;
    }

    @Override
    public void record(AuditEvent e) {
        try {
            repo.insert(List.of(e));
        } catch (RuntimeException ex) {
            log.warn("Cannot write audit log: {}", ex.getMessage());
        }
    }
}
