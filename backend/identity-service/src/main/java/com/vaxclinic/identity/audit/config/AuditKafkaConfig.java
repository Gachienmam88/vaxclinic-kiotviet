package com.vaxclinic.identity.audit.config;

import com.vaxclinic.common.audit.AuditMessage;
import org.apache.kafka.clients.admin.NewTopic;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.annotation.EnableKafka;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.config.TopicBuilder;
import org.springframework.kafka.core.DefaultKafkaConsumerFactory;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.util.backoff.ExponentialBackOff;

import java.util.Map;

/**
 * Nhận lịch sử thao tác từ Kafka (chỉ khi app.audit.transport=kafka). Đọc theo lô, commit offset sau khi ghi DB xong;
 * DB lỗi → thử lại cả lô với backoff 1s..30s, không giới hạn số lần (không bỏ bản tin).
 */
@Configuration
@EnableKafka
@ConditionalOnProperty(name = "app.audit.transport", havingValue = "kafka")
public class AuditKafkaConfig {

    public static final String CONTAINER_FACTORY = "auditListenerFactory";

    @Bean
    public NewTopic auditEventsTopic() {
        return TopicBuilder.name(AuditMessage.TOPIC).partitions(3).replicas(1).build();
    }

    @Bean(CONTAINER_FACTORY)
    public ConcurrentKafkaListenerContainerFactory<String, String> auditListenerFactory(
            @Value("${spring.kafka.bootstrap-servers:localhost:9094}") String servers) {
        var consumers = new DefaultKafkaConsumerFactory<String, String>(Map.of(
                ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, servers,
                ConsumerConfig.GROUP_ID_CONFIG, "identity-audit",
                ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest",
                ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, false,
                ConsumerConfig.MAX_POLL_RECORDS_CONFIG, 200),
                new StringDeserializer(), new StringDeserializer());
        var factory = new ConcurrentKafkaListenerContainerFactory<String, String>();
        factory.setConsumerFactory(consumers);
        factory.setBatchListener(true);
        var backOff = new ExponentialBackOff(1000, 2);
        backOff.setMaxInterval(30_000);
        factory.setCommonErrorHandler(new DefaultErrorHandler(backOff)); // maxElapsedTime mặc định: vô hạn
        return factory;
    }
}
