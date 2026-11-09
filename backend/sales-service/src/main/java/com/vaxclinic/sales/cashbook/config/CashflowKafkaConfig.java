package com.vaxclinic.sales.cashbook.config;

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
 * Sổ quỹ nhận phiếu thu/chi từ Kafka topic cashflow.events (chỉ khi app.cashflow.transport=kafka).
 * Đọc từng bản tin, commit offset sau khi ghi Sổ quỹ xong. Lỗi → thử lại chính bản tin đó (1s..60s, không giới hạn)
 * và KHÔNG đọc bản sau của cùng partition — giữ đúng thứ tự CREATE → UPDATE → CANCEL như outbox HTTP trước đây.
 */
@Configuration
@EnableKafka
@ConditionalOnProperty(name = "app.cashflow.transport", havingValue = "kafka")
public class CashflowKafkaConfig {

    public static final String TOPIC = "cashflow.events";
    public static final String CONTAINER_FACTORY = "cashflowListenerFactory";

    @Bean
    public NewTopic cashflowEventsTopic() {
        return TopicBuilder.name(TOPIC).partitions(3).replicas(1).build();
    }

    @Bean(CONTAINER_FACTORY)
    public ConcurrentKafkaListenerContainerFactory<String, String> cashflowListenerFactory(
            @Value("${spring.kafka.bootstrap-servers:localhost:9094}") String servers) {
        var consumers = new DefaultKafkaConsumerFactory<String, String>(Map.of(
                ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, servers,
                ConsumerConfig.GROUP_ID_CONFIG, "sales-cashbook",
                ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest",
                ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, false),
                new StringDeserializer(), new StringDeserializer());
        var factory = new ConcurrentKafkaListenerContainerFactory<String, String>();
        factory.setConsumerFactory(consumers);
        var backOff = new ExponentialBackOff(1000, 2);
        backOff.setMaxInterval(60_000);
        factory.setCommonErrorHandler(new DefaultErrorHandler(backOff)); // maxElapsedTime mặc định: vô hạn
        return factory;
    }
}
