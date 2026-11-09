package com.vaxclinic.sales.invoice.einvoice;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.common.events.EventEnvelope;
import com.vaxclinic.common.kafka.KafkaProducers;
import com.vaxclinic.sales.invoice.service.InvoiceEvents;
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
 * Nhận trạng thái HĐĐT từ integration-service (topic einvoice.events, chỉ khi app.events.enabled=true) → bảng
 * invoice_einvoice_status. Lỗi hạ tầng (DB...) → thử lại chính bản tin (1s..60s, không giới hạn, giữ thứ tự);
 * BusinessException (không bao giờ thành công) → 3 lần rồi chuyển einvoice.events.DLT, ghi log ERROR kèm eventId.
 * Khai báo luôn topic sales.invoice-events mà sales phát (InvoiceEvents).
 */
@Configuration
@EnableKafka
@ConditionalOnProperty(name = "app.events.enabled", havingValue = "true")
public class EInvoiceStatusKafkaConfig {

    private static final Logger log = LoggerFactory.getLogger(EInvoiceStatusKafkaConfig.class);

    public static final String TOPIC = "einvoice.events";
    public static final String GROUP = "sales-einvoice-status";
    public static final String CONTAINER_FACTORY = "einvoiceStatusListenerFactory";

    @Bean
    public NewTopic einvoiceEventsTopic() {
        return TopicBuilder.name(TOPIC).partitions(3).replicas(1).build();
    }

    @Bean
    public NewTopic einvoiceEventsDltTopic() {
        return TopicBuilder.name(TOPIC + ".DLT").partitions(3).replicas(1).build();
    }

    @Bean
    public NewTopic salesInvoiceEventsTopic() {
        return TopicBuilder.name(InvoiceEvents.TOPIC).partitions(3).replicas(1).build();
    }

    @Bean(CONTAINER_FACTORY)
    public ConcurrentKafkaListenerContainerFactory<String, String> einvoiceStatusListenerFactory(
            @Value("${spring.kafka.bootstrap-servers:localhost:9094}") String servers) {
        var consumers = new DefaultKafkaConsumerFactory<String, String>(Map.of(
                ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, servers,
                ConsumerConfig.GROUP_ID_CONFIG, GROUP,
                ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest",
                ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, false),
                new StringDeserializer(), new StringDeserializer());
        var factory = new ConcurrentKafkaListenerContainerFactory<String, String>();
        factory.setConsumerFactory(consumers);
        var dlt = new DeadLetterPublishingRecoverer(KafkaProducers.reliable(servers, "sales-einvoice-status-dlt"));
        var backOff = new ExponentialBackOff(1000, 2);
        backOff.setMaxInterval(60_000); // maxElapsedTime mặc định: vô hạn
        var errors = new DefaultErrorHandler((record, ex) -> {
            log.error("E-invoice status event {} moved to {}.DLT after retries: {}", eventId(record.value()), TOPIC, ex.getMessage());
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
