package com.vaxclinic.integration.einvoice.service;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.common.events.EventEnvelope;
import com.vaxclinic.common.events.EventOutbox;
import com.vaxclinic.common.http.InternalRestClientFactory;
import com.vaxclinic.integration.einvoice.client.MisaClient;
import com.vaxclinic.integration.einvoice.client.SalesInvoiceClient;
import com.vaxclinic.integration.einvoice.repository.EInvoiceRepository;
import com.vaxclinic.integration.notification.IntegrationAlertJob;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.support.StaticListableBeanFactory;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.AbstractPlatformTransactionManager;
import org.springframework.transaction.support.DefaultTransactionStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** EInvoiceService.publish: app.events.enabled bật → sự kiện einvoice.status-changed khi đổi trạng thái; tắt → như cũ. */
class EInvoicePublishEventsTest {

    record Sent(String topic, String key, String type, EInvoiceEvents.StatusChanged data) {
    }

    static class FakeOutbox extends EventOutbox {
        final List<Sent> sent = new ArrayList<>();

        FakeOutbox() {
            super(null, "integration-service");
        }

        @Override
        public EventEnvelope add(String topic, String key, String type, Object data) {
            sent.add(new Sent(topic, key, type, (EInvoiceEvents.StatusChanged) data));
            return EventEnvelope.of(type, "integration-service", data);
        }
    }

    /** einvoice_records / einvoice_settings trong bộ nhớ. */
    static class FakeRepo extends EInvoiceRepository {
        final Map<UUID, Map<String, Object>> records = new HashMap<>();
        boolean autoPublish;

        FakeRepo() {
            super(null);
        }

        @Override
        public List<Map<String, Object>> findSettingsRows() {
            return List.of(getSettings());
        }

        @Override
        public Map<String, Object> getSettings() {
            return Map.of("inv_series", "2C26MAA", "invoice_name", "Hóa đơn bán hàng", "send_email", false, "auto_publish", autoPublish);
        }

        @Override
        public boolean autoPublish() {
            return autoPublish;
        }

        @Override
        public List<Map<String, Object>> findRecordRows(UUID invoiceId) {
            var r = records.get(invoiceId);
            return r == null ? List.of() : List.of(new HashMap<>(r));
        }

        @Override
        public Map<String, Object> getRecord(UUID invoiceId) {
            return new HashMap<>(records.get(invoiceId));
        }

        @Override
        public void insertFailedRecord(UUID invoiceId, String invoiceCode, UUID refId) {
            var r = new HashMap<String, Object>();
            r.put("invoice_id", invoiceId);
            r.put("invoice_code", invoiceCode);
            r.put("status", "FAILED");
            r.put("ref_id", refId);
            r.put("attempts", 0);
            records.put(invoiceId, r);
        }

        @Override
        public void updateRecordResult(UUID invoiceId, String status, MisaClient.PublishResult res) {
            var r = records.get(invoiceId);
            r.put("status", status);
            r.put("inv_no", res.invNo());
            r.put("error", res.error());
            r.put("attempts", (Integer) r.get("attempts") + 1);
        }
    }

    static class FakeMisa extends MisaClient {
        final List<UUID> refIds = new ArrayList<>();
        boolean ok;

        FakeMisa() {
            super(null, null, null, null, null, null, null);
        }

        @Override
        public PublishResult publish(Account a, Map<String, Object> item) {
            refIds.add(UUID.fromString(String.valueOf(((Map<?, ?>) item.get("OrgInvoiceData")).get("RefID"))));
            if (!ok) {
                throw BusinessException.upstream("MISA_UNREACHABLE", "Không kết nối được MISA meInvoice");
            }
            return new PublishResult(true, "TX1", "2C26MAA", "00000007", null, "2026-11-10", null);
        }
    }

    static class FakeSales extends SalesInvoiceClient {
        String status = "COMPLETED";

        FakeSales() {
            super(InternalRestClientFactory.defaults(), "http://localhost:1", "x".repeat(64));
        }

        @Override
        public SalesInvoice invoice(UUID invoiceId) {
            return new SalesInvoice(invoiceId, "HD000009", status, Instant.parse("2026-11-10T03:00:00Z"), "CASH",
                    new BigDecimal("100000"), BigDecimal.ZERO, new BigDecimal("100000"),
                    new SalesInvoice.Buyer(null, "Khách lẻ", null, null, null, null, null, null),
                    List.of(new SalesInvoice.Line(1, "SP1", "Vắc xin", "Liều", BigDecimal.ONE, new BigDecimal("100000"),
                            BigDecimal.ZERO, "VAT5")));
        }
    }

    /** Transaction giả (không DB) — đủ để TransactionTemplate + afterCommit chạy. */
    static class NoopTxManager extends AbstractPlatformTransactionManager {
        @Override
        protected Object doGetTransaction() {
            return new Object();
        }

        @Override
        protected void doBegin(Object transaction, TransactionDefinition definition) {
        }

        @Override
        protected void doCommit(DefaultTransactionStatus status) {
        }

        @Override
        protected void doRollback(DefaultTransactionStatus status) {
        }
    }

    private final FakeRepo repo = new FakeRepo();
    private final FakeMisa misa = new FakeMisa();
    private final FakeSales sales = new FakeSales();
    private final FakeOutbox outbox = new FakeOutbox();

    private EInvoiceService service(boolean eventsEnabled) {
        var bf = new StaticListableBeanFactory();
        if (eventsEnabled) {
            bf.addBean("eventOutbox", outbox);
        }
        var events = new EInvoiceEvents(bf.getBeanProvider(EventOutbox.class), bf.getBeanProvider(IntegrationAlertJob.class));
        return new EInvoiceService(repo, null, misa, sales, events, new NoopTxManager()) {
            @Override
            public MisaClient.Account account() {
                return new MisaClient.Account("TEST", "app", "0101", "user", "pw");
            }
        };
    }

    @Test
    void failureThenRetrySuccessEmitsOneEventPerStatusChangeAndReusesRefId() {
        var svc = service(true);
        UUID id = UUID.randomUUID();

        svc.publish(id); // MISA không kết nối được → FAILED
        assertEquals("FAILED", repo.records.get(id).get("status"));
        svc.publish(id); // vẫn lỗi: FAILED → FAILED, không phát thêm
        misa.ok = true;
        svc.publish(id); // FAILED → PUBLISHED
        svc.publish(id); // đã PUBLISHED: không gọi MISA, không phát

        assertEquals(3, misa.refIds.size());
        assertEquals(1, misa.refIds.stream().distinct().count()); // thử lại dùng lại RefID
        assertEquals(List.of("FAILED", "PUBLISHED"), outbox.sent.stream().map(s -> s.data().status()).toList());
        var first = outbox.sent.get(0);
        assertEquals("einvoice.events", first.topic());
        assertEquals(id.toString(), first.key());
        assertEquals("einvoice.status-changed", first.type());
        assertNull(first.data().previousStatus());
        assertEquals("Không kết nối được MISA meInvoice", first.data().error());
        var second = outbox.sent.get(1).data();
        assertEquals("FAILED", second.previousStatus());
        assertEquals("00000007", second.invNo());
        assertEquals("HD000009", second.invoiceCode());
    }

    @Test
    void eventsDisabledKeepsOldBehaviourWithoutEvents() {
        var svc = service(false);
        UUID id = UUID.randomUUID();
        misa.ok = true;

        var rec = svc.publish(id);

        assertEquals("PUBLISHED", rec.get("status"));
        assertTrue(outbox.sent.isEmpty());
    }

    @Test
    void recordFailureStoresFailedStatusOnceAndNeverOverwritesPublished() {
        var svc = service(true);
        UUID id = UUID.randomUUID();

        svc.recordFailure(id, "HD000010", "Chưa thiết lập kết nối MISA meInvoice (Thiết lập → Hóa đơn điện tử)");
        svc.recordFailure(id, "HD000010", "Chưa thiết lập kết nối MISA meInvoice (Thiết lập → Hóa đơn điện tử)");

        assertEquals("FAILED", repo.records.get(id).get("status"));
        assertEquals(1, outbox.sent.size());

        UUID published = UUID.randomUUID();
        misa.ok = true;
        svc.publish(published);
        svc.recordFailure(published, "HD000009", "x");
        assertEquals("PUBLISHED", repo.records.get(published).get("status"));
    }
}
