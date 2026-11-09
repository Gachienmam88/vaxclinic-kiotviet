package com.vaxclinic.product.internal.service;

import com.vaxclinic.common.events.EventEnvelope;
import com.vaxclinic.product.internal.config.StockCommandKafkaConfig;
import com.vaxclinic.product.internal.service.InternalStockService.StockDocRequest;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

/**
 * Bản tin stock.commands (từ event_outbox của sales-service: hủy hóa đơn SALE_CANCEL, trả hàng SALE_RETURN) → kho.
 * data = đúng body POST /internal/stock-docs. Bản tin hỏng / loại khác thì bỏ qua (ghi cảnh báo) — gửi lại cũng không đọc được.
 * Lỗi khi ghi kho → ném lại để container thử lại (xem {@link StockCommandKafkaConfig}).
 */
@Component
@ConditionalOnProperty(name = "app.events.enabled", havingValue = "true")
public class StockCommandConsumer {

    private static final Logger log = LoggerFactory.getLogger(StockCommandConsumer.class);

    private final StockCommandHandler handler;

    public StockCommandConsumer(StockCommandHandler handler) {
        this.handler = handler;
    }

    @KafkaListener(topics = StockCommandKafkaConfig.TOPIC, groupId = StockCommandKafkaConfig.GROUP,
            containerFactory = StockCommandKafkaConfig.CONTAINER_FACTORY)
    public void onMessage(ConsumerRecord<String, String> record) {
        EventEnvelope event;
        StockDocRequest request;
        try {
            event = EventEnvelope.fromJson(record.value());
            if (!StockCommandKafkaConfig.TYPE.equals(event.type())) {
                log.warn("Skipping unexpected event type {} ({}) at {}-{}@{}", event.type(), event.eventId(), record.topic(),
                        record.partition(), record.offset());
                return;
            }
            request = event.data(StockDocRequest.class);
            if (request == null || request.docId() == null || request.docType() == null) {
                throw new IllegalArgumentException("stock command missing docId/docType");
            }
        } catch (IllegalArgumentException e) {
            log.warn("Skipping malformed stock command at {}-{}@{}: {}", record.topic(), record.partition(), record.offset(),
                    e.getMessage());
            return;
        }
        if (handler.handle(event, request)) {
            log.info("Stock command {} {} {} applied (event {})", request.docType(), request.docCode(), request.docId(),
                    event.eventId());
        }
    }
}
