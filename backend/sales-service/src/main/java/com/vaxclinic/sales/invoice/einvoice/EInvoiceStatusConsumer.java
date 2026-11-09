package com.vaxclinic.sales.invoice.einvoice;

import com.vaxclinic.common.events.EventEnvelope;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

/**
 * Topic einvoice.events (integration-service): lưu bản sao trạng thái HĐĐT. Bản tin hỏng / thiếu invoiceId, status
 * → bỏ qua (ghi cảnh báo); loại sự kiện khác → bỏ qua.
 */
@Component
@ConditionalOnProperty(name = "app.events.enabled", havingValue = "true")
public class EInvoiceStatusConsumer {

    private static final Logger log = LoggerFactory.getLogger(EInvoiceStatusConsumer.class);

    private final EInvoiceStatusHandler handler;

    public EInvoiceStatusConsumer(EInvoiceStatusHandler handler) {
        this.handler = handler;
    }

    @KafkaListener(topics = EInvoiceStatusKafkaConfig.TOPIC, groupId = EInvoiceStatusKafkaConfig.GROUP,
            containerFactory = EInvoiceStatusKafkaConfig.CONTAINER_FACTORY)
    public void onMessage(ConsumerRecord<String, String> record) {
        EventEnvelope e;
        EInvoiceStatusHandler.StatusChanged d;
        try {
            e = EventEnvelope.fromJson(record.value());
            if (!EInvoiceStatusHandler.STATUS_CHANGED.equals(e.type())) {
                return;
            }
            d = e.data(EInvoiceStatusHandler.StatusChanged.class);
            if (d.invoiceId() == null || d.status() == null) {
                throw new IllegalArgumentException("missing invoiceId/status");
            }
        } catch (IllegalArgumentException ex) {
            log.warn("Skipping malformed e-invoice event at {}-{}@{}: {}", record.topic(), record.partition(), record.offset(),
                    ex.getMessage());
            return;
        }
        handler.handle(e, d);
    }
}
