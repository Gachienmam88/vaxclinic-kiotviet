package com.vaxclinic.common.events;

import com.vaxclinic.common.kafka.KafkaProducers;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Sự kiện nghiệp vụ qua Kafka (app.events.enabled=true): EventOutbox + relay gửi Kafka + ProcessedEvents bỏ trùng.
 * Service bật cờ này phải có migration tạo bảng event_outbox và processed_events.
 */
@AutoConfiguration(afterName = "org.springframework.boot.autoconfigure.jdbc.JdbcTemplateAutoConfiguration")
@ConditionalOnProperty(name = "app.events.enabled", havingValue = "true")
public class EventsAutoConfiguration {

    @Bean
    public EventOutbox eventOutbox(JdbcTemplate jdbc, @Value("${spring.application.name}") String serviceName) {
        return new EventOutbox(jdbc, serviceName);
    }

    @Bean
    public ProcessedEvents processedEvents(JdbcTemplate jdbc) {
        return new ProcessedEvents(jdbc);
    }

    @Bean
    public EventOutboxRelay eventOutboxRelay(JdbcTemplate jdbc, @Value("${spring.application.name}") String serviceName,
                                             @Value("${spring.kafka.bootstrap-servers:localhost:9094}") String servers) {
        return new EventOutboxRelay(jdbc, KafkaProducers.reliable(servers, serviceName + "-events"));
    }
}
