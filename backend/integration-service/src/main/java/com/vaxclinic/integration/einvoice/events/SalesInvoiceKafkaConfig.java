package com.vaxclinic.integration.einvoice.events;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.common.events.EventEnvelope;
import com.vaxclinic.common.kafka.KafkaProducers;
import com.vaxclinic.integration.einvoice.service.EInvoiceEvents;
import org.apache.kafka.clients.admin.NewTopic;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.annotation.EnableKafka;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.config.TopicBuilder;
import org.springframework.kafka.core.DefaultKafkaConsumerFactory;
import org.springframework.kafka.listener.DeadLetterPublishingRecoverer;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.util.backoff.ExponentialBackOff;
import org.springframework.util.backoff.FixedBackOff;

import java.util.Map;

/**
 * Nhận sự kiện hóa đơn bán từ sales-service (topic sales.invoice-events, chỉ khi app.events.enabled=true) → tự phát
 * hành HĐĐT (nếu bật thiết lập). Đọc từng bản tin, commit offset sau khi xử lý xong.
 * Lỗi hạ tầng (sales / DB / identity không trả lời) → thử lại chính bản tin (1s..60s, không giới hạn, giữ thứ tự theo hóa đơn);
 * BusinessException (VD hóa đơn không tồn tại) → 3 lần rồi chuyển sales.invoice-events.DLT, ghi log ERROR kèm eventId.
 * MISA từ chối / lỗi KHÔNG ném ra đây: đã lưu FAILED vào einvoice_records (như phát hành tay) rồi ack.
 * Khai báo luôn topic einvoice.events mà integration phát (EInvoiceEvents).
 */
@Configuration
@EnableKafka
@ConditionalOnProperty(name = "app.events.enabled", havingValue = "true")
public class SalesInvoiceKafkaConfig {

    private static final Logger log = LoggerFactory.getLogger(SalesInvoiceKafkaConfig.class);

    public static final String TOPIC = "sales.invoice-events";
    public static final String GROUP = "integration-einvoice";
    public static final String CONTAINER_FACTORY = "salesInvoiceListenerFactory";

    @Bean
    public NewTopic salesInvoiceEventsTopic() {
        return TopicBuilder.name(TOPIC).partitions(3).replicas(1).build();
    }

    @Bean
    public NewTopic salesInvoiceEventsDltTopic() {
        return TopicBuilder.name(TOPIC + ".DLT").partitions(3).replicas(1).build();
    }

    @Bean
    public NewTopic einvoiceEventsTopic() {
        return TopicBuilder.name(EInvoiceEvents.TOPIC).partitions(3).replicas(1).build();
    }

    @Bean(CONTAINER_FACTORY)
    public ConcurrentKafkaListenerContainerFactory<String, String> salesInvoiceListenerFactory(
            @Value("${spring.kafka.bootstrap-servers:localhost:9094}") String servers) {
        var consumers = new DefaultKafkaConsumerFactory<String, String>(Map.of(
                ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, servers,
                ConsumerConfig.GROUP_ID_CONFIG, GROUP,
                ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest",
                ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, false,
                // gọi MISA tối đa ~30s/hóa đơn: nới thời gian giữa 2 lần poll để không bị coi là chết
                ConsumerConfig.MAX_POLL_RECORDS_CONFIG, 20,
                ConsumerConfig.MAX_POLL_INTERVAL_MS_CONFIG, 900_000),
                new StringDeserializer(), new StringDeserializer());
        var factory = new ConcurrentKafkaListenerContainerFactory<String, String>();
        factory.setConsumerFactory(consumers);
        var dlt = new DeadLetterPublishingRecoverer(KafkaProducers.reliable(servers, "integration-einvoice-dlt"));
        var backOff = new ExponentialBackOff(1000, 2);
        backOff.setMaxInterval(60_000); // maxElapsedTime mặc định: vô hạn
        var errors = new DefaultErrorHandler((record, ex) -> {
            log.error("Sales invoice event {} moved to {}.DLT after retries: {}", eventId(record.value()), TOPIC, ex.getMessage());
            dlt.accept(record, ex);
        }, backOff);
        errors.setBackOffFunction((record, ex) -> isBusiness(ex) ? new FixedBackOff(1000, 2) : null); // 3 lần
        factory.setCommonErrorHandler(errors);
        return factory;
    }

    static boolean isBusiness(Throwable ex) {
        for (Throwable t = ex; t != null; t = t.getCause()) {
            if (t instanceof BusinessException) {
                return true;
            }
        }
        return false;
    }

    private static String eventId(Object value) {
        try {
            return String.valueOf(EventEnvelope.fromJson(String.valueOf(value)).eventId());
        } catch (RuntimeException e) {
            return "?";
        }
    }
}
