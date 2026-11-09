package com.vaxclinic.identity.audit.dto;

import java.time.Instant;
import java.util.UUID;

/** Một dòng Lịch sử thao tác (GET /api/audit-logs). */
public record AuditLogItem(long id, Instant occurredAt, UUID userId, String userName, UUID branchId, String feature,
                           String action, String docCode, String detail) {
}
