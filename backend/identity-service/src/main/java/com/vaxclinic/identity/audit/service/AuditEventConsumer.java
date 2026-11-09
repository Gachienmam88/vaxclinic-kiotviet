package com.vaxclinic.identity.audit.service;

import com.vaxclinic.common.audit.AuditMessage;
import com.vaxclinic.identity.audit.config.AuditKafkaConfig;
import com.vaxclinic.identity.audit.repository.AuditLogRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * Ghi lịch sử thao tác từ topic audit.events vào bảng audit_logs (trùng event_id thì bỏ qua).
 * Bản tin hỏng (JSON sai, vi phạm ràng buộc dữ liệu) bị bỏ qua kèm cảnh báo để không chặn cả partition;
 * lỗi khác (DB mất kết nối...) ném ra → container thử lại cả lô.
 */
@Component
@ConditionalOnProperty(name = "app.audit.transport", havingValue = "kafka")
public class AuditEventConsumer {

    private static final Logger log = LoggerFactory.getLogger(AuditEventConsumer.class);

    private final AuditLogRepository repository;

    public AuditEventConsumer(AuditLogRepository repository) {
        this.repository = repository;
    }

    @KafkaListener(topics = AuditMessage.TOPIC, groupId = "identity-audit", containerFactory = AuditKafkaConfig.CONTAINER_FACTORY)
    public void onMessages(List<String> payloads) {
        List<AuditMessage> messages = new ArrayList<>(payloads.size());
        for (String json : payloads) {
            try {
                messages.add(AuditMessage.fromJson(json));
            } catch (IllegalArgumentException e) {
                log.warn("Skipping malformed audit message: {}", e.getMessage());
            }
        }
        if (messages.isEmpty()) {
            return;
        }
        try {
            repository.insertMessages(messages);
        } catch (DataIntegrityViolationException batchError) {
            // 1 bản tin vi phạm ràng buộc làm hỏng cả lô → ghi từng bản, bỏ bản lỗi
            for (AuditMessage m : messages) {
                try {
                    repository.insertMessages(List.of(m));
                } catch (DataIntegrityViolationException e) {
                    log.warn("Skipping invalid audit message {} from {}: {}", m.eventId(), m.source(), e.getMostSpecificCause().getMessage());
                }
            }
        }
    }
}
