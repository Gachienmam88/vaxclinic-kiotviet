package com.vaxclinic.identity.audit.service;

import com.vaxclinic.identity.audit.repository.AuditLogRepository;
import com.vaxclinic.common.audit.AuditLogger;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;

/** identity-service tự ghi thẳng DB (không gọi HTTP vào chính mình). */
@Component
public class JdbcAuditLogger implements AuditLogger {
    private static final Logger log = LoggerFactory.getLogger(JdbcAuditLogger.class);
    private final JdbcTemplate jdbc;

    public JdbcAuditLogger(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void record(AuditEvent e) {
        try {
            AuditLogRepository.insert(jdbc, List.of(e));
        } catch (RuntimeException ex) {
            log.warn("Cannot write audit log: {}", ex.getMessage());
        }
    }
}
