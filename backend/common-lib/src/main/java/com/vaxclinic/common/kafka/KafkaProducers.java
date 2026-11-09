package com.vaxclinic.common.kafka;

import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.common.serialization.StringSerializer;
import org.springframework.kafka.core.DefaultKafkaProducerFactory;
import org.springframework.kafka.core.KafkaTemplate;

import java.util.Map;

/**
 * Producer Kafka "an toàn" dùng chung: acks=all + idempotent (không mất, không nhân bản khi gửi lại),
 * không chặn quá 2 giây khi Kafka chết, bỏ cuộc sau 30 giây (người gọi tự xử lý: gửi lại / rơi về HTTP).
 * Key và value là chuỗi (value = JSON).
 */
public final class KafkaProducers {

    private KafkaProducers() {
    }

    public static KafkaTemplate<String, String> reliable(String bootstrapServers, String clientId) {
        return new KafkaTemplate<>(new DefaultKafkaProducerFactory<>(Map.of(
                ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers,
                ProducerConfig.CLIENT_ID_CONFIG, clientId,
                ProducerConfig.ACKS_CONFIG, "all",
                ProducerConfig.ENABLE_IDEMPOTENCE_CONFIG, true,
                ProducerConfig.LINGER_MS_CONFIG, 20,
                ProducerConfig.MAX_BLOCK_MS_CONFIG, 2000,
                ProducerConfig.REQUEST_TIMEOUT_MS_CONFIG, 10_000,
                ProducerConfig.DELIVERY_TIMEOUT_MS_CONFIG, 30_000),
                new StringSerializer(), new StringSerializer()));
    }
}
