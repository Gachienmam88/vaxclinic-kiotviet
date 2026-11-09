package com.vaxclinic.identity.notification.config;

import com.vaxclinic.common.notification.NotificationClient;
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
 * Hộp thư đến nhận cảnh báo từ Kafka topic notification.events (chỉ khi app.notification.transport=kafka).
 * 1 partition: các service gửi chung 1 key nên thứ tự sync/publish được giữ nguyên. DB lỗi → thử lại (1s..30s, vô hạn).
 */
@Configuration
@EnableKafka
@ConditionalOnProperty(name = "app.notification.transport", havingValue = "kafka")
public class NotificationKafkaConfig {

    public static final String CONTAINER_FACTORY = "notificationListenerFactory";

    @Bean
    public NewTopic notificationEventsTopic() {
        return TopicBuilder.name(NotificationClient.TOPIC).partitions(1).replicas(1).build();
    }

    @Bean(CONTAINER_FACTORY)
    public ConcurrentKafkaListenerContainerFactory<String, String> notificationListenerFactory(
            @Value("${spring.kafka.bootstrap-servers:localhost:9094}") String servers) {
        var consumers = new DefaultKafkaConsumerFactory<String, String>(Map.of(
                ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, servers,
                ConsumerConfig.GROUP_ID_CONFIG, "identity-notifications",
                ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest",
                ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, false),
                new StringDeserializer(), new StringDeserializer());
        var factory = new ConcurrentKafkaListenerContainerFactory<String, String>();
        factory.setConsumerFactory(consumers);
        var backOff = new ExponentialBackOff(1000, 2);
        backOff.setMaxInterval(30_000);
        factory.setCommonErrorHandler(new DefaultErrorHandler(backOff));
        return factory;
    }
}
