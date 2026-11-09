package com.vaxclinic.common.audit;

import com.vaxclinic.common.audit.AuditLogger.AuditEvent;
import org.apache.kafka.clients.producer.MockProducer;
import org.apache.kafka.common.serialization.StringSerializer;
import org.junit.jupiter.api.Test;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.mock.MockProducerFactory;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.BooleanSupplier;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class KafkaAuditLoggerTest {

    private final UUID user = UUID.randomUUID();
    private final AuditEvent event = new AuditEvent(Instant.parse("2026-11-09T10:15:30Z"), user, "admin", null,
            "Hóa đơn", "Tạo", "HD000001", "Tạo hóa đơn HD000001");
    private final List<AuditEvent> fallbackEvents = new CopyOnWriteArrayList<>();
    private final AuditLogger fallback = fallbackEvents::add;

    @Test
    void messageRoundTripsThroughJson() {
        AuditMessage m = AuditMessage.of("sales-service", event);
        String json = m.toJson();
        assertTrue(json.contains("\"occurredAt\":\"2026-11-09T10:15:30Z\""), json);
        assertEquals(m, AuditMessage.fromJson(json));
    }

    @Test
    void sendsToAuditTopicKeyedByUser() throws Exception {
        var producer = new MockProducer<>(true, new StringSerializer(), new StringSerializer());
        var logger = new KafkaAuditLogger(new KafkaTemplate<>(new MockProducerFactory<>(() -> producer)), fallback, "sales-service");

        logger.record(event);
        waitFor(() -> producer.history().size() == 1);
        var sent = producer.history().get(0);
        logger.destroy();

        assertEquals(AuditMessage.TOPIC, sent.topic());
        assertEquals(user.toString(), sent.key());
        AuditMessage msg = AuditMessage.fromJson(sent.value());
        assertEquals(event, msg.event());
        assertEquals("sales-service", msg.source());
        assertTrue(fallbackEvents.isEmpty());
    }

    @Test
    void fallsBackToHttpWhenKafkaRejects() throws Exception {
        var producer = new MockProducer<>(false, new StringSerializer(), new StringSerializer());
        var logger = new KafkaAuditLogger(new KafkaTemplate<>(new MockProducerFactory<>(() -> producer)), fallback, "product-service");

        logger.record(event);
        waitFor(() -> producer.history().size() == 1);
        producer.errorNext(new RuntimeException("broker down"));
        waitFor(() -> fallbackEvents.size() == 1);
        assertEquals(event, fallbackEvents.get(0));
        logger.destroy();
    }

    @Test
    void nullUserMeansNullKey() throws Exception {
        var producer = new MockProducer<>(true, new StringSerializer(), new StringSerializer());
        var logger = new KafkaAuditLogger(new KafkaTemplate<>(new MockProducerFactory<>(() -> producer)), fallback, "x");
        logger.record(new AuditEvent(Instant.now(), null, null, null, "Hệ thống", "Chạy", null, null));
        waitFor(() -> producer.history().size() == 1);
        assertNull(producer.history().get(0).key());
        logger.destroy();
    }

    private static void waitFor(BooleanSupplier condition) throws InterruptedException {
        long deadline = System.currentTimeMillis() + 5000;
        while (!condition.getAsBoolean()) {
            if (System.currentTimeMillis() > deadline) {
                throw new AssertionError("condition not met within 5s");
            }
            Thread.sleep(10);
        }
    }
}
