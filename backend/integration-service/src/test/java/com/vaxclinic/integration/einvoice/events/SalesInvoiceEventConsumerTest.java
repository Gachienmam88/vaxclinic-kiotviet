package com.vaxclinic.integration.einvoice.events;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.common.events.EventEnvelope;
import com.vaxclinic.common.events.ProcessedEvents;
import com.vaxclinic.common.notification.NotificationClient;
import com.vaxclinic.integration.einvoice.service.EInvoiceService;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.ResourceAccessException;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SalesInvoiceEventConsumerTest {

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

    /** EInvoiceService giả: autoPublish / publish / recordFailure / record. */
    static class FakeEInvoice extends EInvoiceService {
        boolean autoPublish;
        RuntimeException publishError;
        final List<UUID> published = new ArrayList<>();
        final List<String> failures = new ArrayList<>();
        final Map<UUID, Map<String, Object>> records = new HashMap<>();

        FakeEInvoice() {
            super(null, null, null, null, null, null);
        }

        @Override
        public boolean autoPublish() {
            return autoPublish;
        }

        @Override
        public Map<String, Object> publish(UUID invoiceId) {
            if (publishError != null) {
                throw publishError;
            }
            published.add(invoiceId);
            return Map.of("status", "PUBLISHED");
        }

        @Override
        public void recordFailure(UUID invoiceId, String invoiceCode, String error) {
            failures.add(invoiceCode + ": " + error);
        }

        @Override
        public Optional<Map<String, Object>> record(UUID invoiceId) {
            return Optional.ofNullable(records.get(invoiceId));
        }
    }

    static class FakeNotifications extends NotificationClient {
        final List<Item> sent = new ArrayList<>();
        boolean down;

        FakeNotifications() {
            super(null, null);
        }

        @Override
        public boolean publish(List<Item> items) {
            if (down) {
                return false;
            }
            sent.addAll(items);
            return true;
        }
    }

    private final FakeEInvoice einvoice = new FakeEInvoice();
    private final FakeNotifications notifications = new FakeNotifications();
    private final SalesInvoiceEventConsumer consumer = new SalesInvoiceEventConsumer(
            new SalesInvoiceEventHandler(new FakeProcessed(), einvoice, notifications));
    private final UUID invoiceId = UUID.randomUUID();
    private final UUID branchId = UUID.randomUUID();

    private static ConsumerRecord<String, String> record(String value) {
        return new ConsumerRecord<>("sales.invoice-events", 0, 0L, "k", value);
    }

    /** Đúng dạng sales-service InvoiceEvents ghi vào outbox. */
    private String event(String type) {
        return EventEnvelope.of(type, "sales-service", Map.of("invoiceId", invoiceId, "code", "HD000042", "branchId", branchId,
                "total", new BigDecimal("250000"), "occurredAt", Instant.parse("2026-11-10T03:00:00Z"))).toJson();
    }

    @Test
    void autoPublishOffByDefaultDoesNothing() {
        consumer.onMessage(record(event("invoice.completed")));
        assertTrue(einvoice.published.isEmpty());
        assertTrue(einvoice.failures.isEmpty());
    }

    @Test
    void autoPublishOnPublishesOnceEvenIfRedelivered() {
        einvoice.autoPublish = true;
        String msg = event("invoice.completed");
        consumer.onMessage(record(msg));
        consumer.onMessage(record(msg));
        assertEquals(List.of(invoiceId), einvoice.published);
    }

    @Test
    void notConfiguredIsStoredAsFailureAndAcked() {
        einvoice.autoPublish = true;
        einvoice.publishError = BusinessException.badRequest("EINVOICE_NOT_CONFIGURED",
                "Chưa thiết lập kết nối MISA meInvoice (Thiết lập → Hóa đơn điện tử)");
        consumer.onMessage(record(event("invoice.completed"))); // không ném → offset được commit
        assertEquals(List.of("HD000042: Chưa thiết lập kết nối MISA meInvoice (Thiết lập → Hóa đơn điện tử)"), einvoice.failures);
    }

    @Test
    void notPublishableAnyMoreIsSkippedWithoutFailureRecord() {
        einvoice.autoPublish = true;
        einvoice.publishError = BusinessException.badRequest("INVOICE_NOT_PUBLISHABLE", "Chỉ phát hành được hóa đơn đã hoàn thành");
        consumer.onMessage(record(event("invoice.completed")));
        assertTrue(einvoice.failures.isEmpty());
    }

    @Test
    void salesDownIsRethrownForRetryAndMissingInvoiceIsBusiness() {
        einvoice.autoPublish = true;
        einvoice.publishError = new ResourceAccessException("sales down");
        assertThrows(ResourceAccessException.class, () -> consumer.onMessage(record(event("invoice.completed"))));

        einvoice.publishError = HttpClientErrorException.create(HttpStatus.NOT_FOUND, "Not Found", null, null, null);
        var ex = assertThrows(BusinessException.class, () -> consumer.onMessage(record(event("invoice.completed"))));
        assertTrue(SalesInvoiceKafkaConfig.isBusiness(ex)); // → DLT sau 3 lần
        assertFalse(SalesInvoiceKafkaConfig.isBusiness(new ResourceAccessException("x")));
    }

    @Test
    void cancellingInvoiceWithPublishedEInvoiceNotifiesButDoesNotTouchEInvoice() {
        einvoice.autoPublish = true;
        einvoice.records.put(invoiceId, Map.of("status", "PUBLISHED", "inv_series", "2C26MAA", "inv_no", "00000007"));

        consumer.onMessage(record(event("invoice.cancelled")));

        assertTrue(einvoice.published.isEmpty());
        assertEquals(1, notifications.sent.size());
        var item = notifications.sent.get(0);
        assertEquals("EINVOICE_INVOICE_CANCELLED", item.type());
        assertEquals("einvoice_invoice_cancelled:" + invoiceId, item.dedupeKey());
        assertEquals("HD000042", item.docCode());
        assertEquals(branchId, item.branchId());
        assertTrue(item.body().contains("2C26MAA-00000007"));
    }

    @Test
    void cancelNotificationFailureIsRetriedAndUnpublishedCancelIsJustLogged() {
        einvoice.records.put(invoiceId, Map.of("status", "PUBLISHED"));
        notifications.down = true;
        assertThrows(IllegalStateException.class, () -> consumer.onMessage(record(event("invoice.cancelled"))));

        einvoice.records.put(invoiceId, Map.of("status", "FAILED"));
        notifications.down = false;
        consumer.onMessage(record(event("invoice.cancelled")));
        consumer.onMessage(record(event("invoice.updated")));
        assertTrue(notifications.sent.isEmpty());
    }

    @Test
    void malformedMessagesAreSkipped() {
        einvoice.autoPublish = true;
        consumer.onMessage(record("{oops"));
        consumer.onMessage(record(EventEnvelope.of("invoice.completed", "sales-service", Map.of("code", "HD1")).toJson()));
        assertTrue(einvoice.published.isEmpty());
    }
}
