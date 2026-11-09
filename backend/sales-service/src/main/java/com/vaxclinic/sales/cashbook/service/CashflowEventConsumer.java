package com.vaxclinic.sales.cashbook.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vaxclinic.sales.cashbook.config.CashflowKafkaConfig;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

/**
 * Bản tin cashflow.events (từ CashflowOutbox của product-service) → Sổ quỹ. Cùng logic với POST /internal/cashflows:
 * {@link CashbookService#inbound} idempotent theo (sourceType, sourceId), nên bản tin giao lại không tạo phiếu trùng.
 * Bản tin không đọc được JSON thì bỏ qua (ghi cảnh báo) — gửi lại cũng không bao giờ đọc được.
 */
@Component
@ConditionalOnProperty(name = "app.cashflow.transport", havingValue = "kafka")
public class CashflowEventConsumer {

    private static final Logger log = LoggerFactory.getLogger(CashflowEventConsumer.class);

    private final CashbookService cashbook;
    private final ObjectMapper json;

    public CashflowEventConsumer(CashbookService cashbook, ObjectMapper json) {
        this.cashbook = cashbook;
        this.json = json;
    }

    @KafkaListener(topics = CashflowKafkaConfig.TOPIC, groupId = "sales-cashbook", containerFactory = CashflowKafkaConfig.CONTAINER_FACTORY)
    public void onMessage(ConsumerRecord<String, String> record) {
        CashbookService.InboundCashflow in;
        try {
            in = json.readValue(record.value(), CashbookService.InboundCashflow.class);
        } catch (JsonProcessingException e) {
            log.warn("Skipping malformed cashflow message at {}-{}@{}: {}", record.topic(), record.partition(), record.offset(),
                    e.getOriginalMessage());
            return;
        }
        cashbook.inbound(in);
        log.info("Cashflow {} {} {} applied to cashbook", in.action(), in.sourceType(), in.code() != null ? in.code() : in.sourceId());
    }
}
