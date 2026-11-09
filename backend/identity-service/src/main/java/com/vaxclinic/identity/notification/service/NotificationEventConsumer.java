package com.vaxclinic.identity.notification.service;

import com.vaxclinic.common.events.EventEnvelope;
import com.vaxclinic.common.notification.NotificationClient;
import com.vaxclinic.common.notification.NotificationClient.PublishRequest;
import com.vaxclinic.common.notification.NotificationClient.SyncRequest;
import com.vaxclinic.identity.notification.config.NotificationKafkaConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * notification.events → Hộp thư đến, cùng logic với POST /internal/notifications và /internal/notifications/sync.
 * Cả 2 thao tác vốn idempotent (upsert theo dedupeKey; sync = thay trọn bộ) nên giao lại không sinh trùng.
 */
@Component
@ConditionalOnProperty(name = "app.notification.transport", havingValue = "kafka")
public class NotificationEventConsumer {

    private static final Logger log = LoggerFactory.getLogger(NotificationEventConsumer.class);

    private final NotificationWriter writer;

    public NotificationEventConsumer(NotificationWriter writer) {
        this.writer = writer;
    }

    @KafkaListener(topics = NotificationClient.TOPIC, groupId = "identity-notifications",
            containerFactory = NotificationKafkaConfig.CONTAINER_FACTORY)
    public void onMessage(String payload) {
        EventEnvelope e;
        try {
            e = EventEnvelope.fromJson(payload);
        } catch (IllegalArgumentException ex) {
            log.warn("Skipping malformed notification message: {}", ex.getMessage());
            return;
        }
        switch (e.type()) {
            case NotificationClient.TYPE_PUBLISH -> {
                List<NotificationClient.Item> items = e.data(PublishRequest.class).items();
                if (items != null && !items.isEmpty()) {
                    writer.upsert(items);
                }
            }
            case NotificationClient.TYPE_SYNC -> {
                SyncRequest req = e.data(SyncRequest.class);
                if (req.types() != null && !req.types().isEmpty()) {
                    writer.sync(req.types(), req.items() == null ? List.of() : req.items());
                }
            }
            default -> log.warn("Skipping unknown notification event type {} ({})", e.type(), e.eventId());
        }
    }
}
