package com.vaxclinic.sales.invoice.einvoice;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.common.events.EventEnvelope;
import com.vaxclinic.common.events.ProcessedEvents;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class EInvoiceStatusConsumerTest {

    static class FakeProcessed extends ProcessedEvents {
        final Set<UUID> seen = new HashSet<>();

        FakeProcessed() {
            super(null);
        }

        @Override
        public boolean firstTime(EventEnvelope e) {
            return seen.add(e.eventId());
        }
    }

    record Row(UUID invoiceId, String status, String no, Instant at, UUID eventId) {
    }

    static class FakeStore extends EInvoiceStatusStore {
        final List<Row> rows = new ArrayList<>();
        boolean fail;

        FakeStore() {
            super(null);
        }

        @Override
        public void upsert(UUID invoiceId, String status, String einvoiceNo, Instant updatedAt, UUID eventId) {
            if (fail) {
                throw new IllegalStateException("db down");
            }
            rows.add(new Row(invoiceId, status, einvoiceNo, updatedAt, eventId));
        }
    }

    private final FakeStore store = new FakeStore();
    private final EInvoiceStatusConsumer consumer = new EInvoiceStatusConsumer(new EInvoiceStatusHandler(new FakeProcessed(), store));

    private static ConsumerRecord<String, String> record(String value) {
        return new ConsumerRecord<>("einvoice.events", 0, 0L, "k", value);
    }

    private static String event(String type, Object data) {
        return EventEnvelope.of(type, "integration-service", data).toJson();
    }

    @Test
    void statusChangedIsStoredOnceEvenIfRedelivered() {
        UUID invoice = UUID.randomUUID();
        Instant at = Instant.parse("2026-11-10T03:00:00Z");
        String msg = event("einvoice.status-changed", Map.of("invoiceId", invoice, "invoiceCode", "HD000001",
                "status", "PUBLISHED", "invNo", "00000012", "occurredAt", at, "previousStatus", "FAILED"));

        consumer.onMessage(record(msg));
        consumer.onMessage(record(msg)); // Kafka giao lại

        assertEquals(1, store.rows.size());
        Row r = store.rows.get(0);
        assertEquals(invoice, r.invoiceId());
        assertEquals("PUBLISHED", r.status());
        assertEquals("00000012", r.no());
        assertEquals(at, r.at());
    }

    @Test
    void malformedOrForeignMessagesAreSkipped() {
        consumer.onMessage(record("not json"));
        consumer.onMessage(record(event("einvoice.status-changed", Map.of("invoiceCode", "HD1"))));
        consumer.onMessage(record(event("something.else", Map.of("invoiceId", UUID.randomUUID(), "status", "FAILED"))));
        assertTrue(store.rows.isEmpty());
    }

    @Test
    void infrastructureErrorIsRethrownForRetry() {
        store.fail = true;
        String msg = event("einvoice.status-changed", Map.of("invoiceId", UUID.randomUUID(), "status", "FAILED"));
        assertThrows(IllegalStateException.class, () -> consumer.onMessage(record(msg)));
    }

    @Test
    void businessExceptionIsDetectedThroughWrappers() {
        assertTrue(EInvoiceStatusKafkaConfig.isBusiness(new RuntimeException(BusinessException.badRequest("X", "y"))));
        assertFalse(EInvoiceStatusKafkaConfig.isBusiness(new IllegalStateException("db down")));
    }
}
