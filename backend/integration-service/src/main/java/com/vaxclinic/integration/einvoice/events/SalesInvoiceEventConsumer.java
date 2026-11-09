package com.vaxclinic.integration.einvoice.events;

import com.vaxclinic.common.events.EventEnvelope;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

/**
 * Topic sales.invoice-events (sales-service InvoiceEvents). Bản tin hỏng / thiếu invoiceId → bỏ qua (ghi cảnh báo):
 * gửi lại cũng không bao giờ đọc được. Xử lý: {@link SalesInvoiceEventHandler}.
 */
@Component
@ConditionalOnProperty(name = "app.events.enabled", havingValue = "true")
public class SalesInvoiceEventConsumer {

    private static final Logger log = LoggerFactory.getLogger(SalesInvoiceEventConsumer.class);

    private final SalesInvoiceEventHandler handler;

    public SalesInvoiceEventConsumer(SalesInvoiceEventHandler handler) {
        this.handler = handler;
    }

    @KafkaListener(topics = SalesInvoiceKafkaConfig.TOPIC, groupId = SalesInvoiceKafkaConfig.GROUP,
            containerFactory = SalesInvoiceKafkaConfig.CONTAINER_FACTORY)
    public void onMessage(ConsumerRecord<String, String> record) {
        EventEnvelope e;
        SalesInvoiceEventHandler.InvoiceEvent d;
        try {
            e = EventEnvelope.fromJson(record.value());
            d = e.data(SalesInvoiceEventHandler.InvoiceEvent.class);
            if (d.invoiceId() == null) {
                throw new IllegalArgumentException("missing invoiceId");
            }
        } catch (IllegalArgumentException ex) {
            log.warn("Skipping malformed sales invoice event at {}-{}@{}: {}", record.topic(), record.partition(), record.offset(),
                    ex.getMessage());
            return;
        }
        handler.handle(e, d);
    }
}
