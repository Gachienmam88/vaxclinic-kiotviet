package com.vaxclinic.product.internal.config;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.common.events.EventEnvelope;
import com.vaxclinic.common.kafka.KafkaProducers;
import org.apache.kafka.clients.admin.NewTopic;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.common.TopicPartition;
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
import org.springframework.kafka.listener.ConsumerRecordRecoverer;
import org.springframework.kafka.listener.DeadLetterPublishingRecoverer;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.util.backoff.BackOff;
import org.springframework.util.backoff.ExponentialBackOff;
import org.springframework.util.backoff.FixedBackOff;

import java.util.Map;

/**
 * Kho nhận yêu cầu hoàn kho từ sales-service qua Kafka topic stock.commands (app.events.enabled=true).
 * Commit offset sau khi kho ghi xong. Lỗi hạ tầng (DB...) → thử lại chính bản tin đó (1s..60s, không giới hạn), giữ thứ tự
 * theo chứng từ (key = docId). Kho từ chối nghiệp vụ (BusinessException — thử lại cũng không qua) → sau 3 lần chuyển sang
 * stock.commands.DLT + log ERROR kèm eventId, để không chặn cả partition.
 */
@Configuration
@EnableKafka
@ConditionalOnProperty(name = "app.events.enabled", havingValue = "true")
public class StockCommandKafkaConfig {

    private static final Logger log = LoggerFactory.getLogger(StockCommandKafkaConfig.class);

    public static final String TOPIC = "stock.commands";
    public static final String DLT = TOPIC + ".DLT";
    public static final String TYPE = "stock.doc.requested";
    public static final String GROUP = "product-stock-commands";
    public static final String CONTAINER_FACTORY = "stockCommandListenerFactory";
    /** Số lần xử lý 1 bản tin bị từ chối nghiệp vụ trước khi đưa vào DLT. */
    static final int BUSINESS_ATTEMPTS = 3;

    @Bean
    public NewTopic stockCommandsTopic() {
        return TopicBuilder.name(TOPIC).partitions(3).replicas(1).build();
    }

    @Bean
    public NewTopic stockCommandsDltTopic() {
        return TopicBuilder.name(DLT).partitions(1).replicas(1).build();
    }

    @Bean(CONTAINER_FACTORY)
    public ConcurrentKafkaListenerContainerFactory<String, String> stockCommandListenerFactory(
            @Value("${spring.kafka.bootstrap-servers:localhost:9094}") String servers) {
        var consumers = new DefaultKafkaConsumerFactory<String, String>(Map.of(
                ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, servers,
                ConsumerConfig.GROUP_ID_CONFIG, GROUP,
                ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest",
                ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, false),
                new StringDeserializer(), new StringDeserializer());
        var factory = new ConcurrentKafkaListenerContainerFactory<String, String>();
        factory.setConsumerFactory(consumers);
        // DLT chỉ có 1 partition → không giữ partition gốc (-1 = để Kafka chọn)
        var deadLetter = new DeadLetterPublishingRecoverer(KafkaProducers.reliable(servers, "product-service-stock-dlt"),
                (record, e) -> new TopicPartition(DLT, -1));
        ConsumerRecordRecoverer recoverer = (record, e) -> {
            log.error("Stock command event {} (key {}, {}-{}@{}) rejected {} times -> {}: {}", eventIdOf(record), record.key(),
                    record.topic(), record.partition(), record.offset(), BUSINESS_ATTEMPTS, DLT, rootMessage(e));
            deadLetter.accept(record, e);
        };
        var handler = new DefaultErrorHandler(recoverer, infiniteBackOff()); // lỗi hạ tầng: maxElapsedTime vô hạn
        handler.setBackOffFunction((record, e) -> backOffFor(e));
        factory.setCommonErrorHandler(handler);
        return factory;
    }

    static ExponentialBackOff infiniteBackOff() {
        var backOff = new ExponentialBackOff(1000, 2);
        backOff.setMaxInterval(60_000);
        return backOff;
    }

    /** BusinessException (kể cả bọc trong ListenerExecutionFailedException) → 3 lần rồi DLT; còn lại null = backoff mặc định. */
    static BackOff backOffFor(Exception e) {
        return businessCause(e) != null ? new FixedBackOff(1000, BUSINESS_ATTEMPTS - 1) : null;
    }

    static BusinessException businessCause(Throwable e) {
        for (Throwable t = e; t != null; t = t.getCause() == t ? null : t.getCause()) {
            if (t instanceof BusinessException be) {
                return be;
            }
        }
        return null;
    }

    private static String eventIdOf(ConsumerRecord<?, ?> record) {
        try {
            return String.valueOf(EventEnvelope.fromJson(String.valueOf(record.value())).eventId());
        } catch (RuntimeException ex) {
            return "?";
        }
    }

    private static String rootMessage(Exception e) {
        BusinessException be = businessCause(e);
        return be != null ? be.getCode() + " " + be.getMessage() : String.valueOf(e.getMessage());
    }
}
