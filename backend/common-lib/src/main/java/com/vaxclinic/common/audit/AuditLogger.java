package com.vaxclinic.common.audit;

import java.time.Instant;
import java.util.UUID;

/**
 * Ghi "Lịch sử thao tác" (Thiết lập → Lịch sử thao tác). identity-service ghi thẳng DB; service khác gửi qua HTTP
 * ({@link HttpAuditLogger}). Ghi log KHÔNG được làm hỏng nghiệp vụ: mọi lỗi chỉ được log cảnh báo.
 */
public interface AuditLogger {

    /** feature: tính năng (Hóa đơn, Phiếu thu...); detail: mô tả cho người đọc, VD "Tạo hóa đơn HD000123, khách ...". */
    record AuditEvent(Instant occurredAt, UUID userId, String userName, UUID branchId, String feature, String action,
                      String docCode, String detail) {
    }

    void record(AuditEvent event);

    default void record(UUID userId, String userName, UUID branchId, String feature, String action, String docCode, String detail) {
        record(new AuditEvent(Instant.now(), userId, userName, branchId, feature, action, docCode,
                detail != null && detail.length() > 1000 ? detail.substring(0, 1000) : detail));
    }
}
