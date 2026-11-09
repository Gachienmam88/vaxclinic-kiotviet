package com.vaxclinic.product.internal.service;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.common.events.EventEnvelope;
import com.vaxclinic.common.events.ProcessedEvents;
import com.vaxclinic.product.internal.service.InternalStockService.StockDocRequest;
import com.vaxclinic.product.internal.service.InternalStockService.StockDocResult;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class StockCommandConsumerTest {

    /** Kho giả: ghi lại yêu cầu; reject = mô phỏng kho từ chối / DB lỗi. */
    static class FakeStock extends InternalStockService {
        final List<StockDocRequest> applied = new ArrayList<>();
        RuntimeException reject;

        FakeStock() {
            super(null, null, null, null, null, null, null);
        }

        @Override
        public StockDocResult apply(StockDocRequest req) {
            if (reject != null) {
                throw reject;
            }
            applied.add(req);
            return new StockDocResult(req.docId(), req.docType(), List.of());
        }
    }

    /** processed_events trong RAM. */
    static class FakeProcessed extends ProcessedEvents {
        final Set<UUID> seen = new HashSet<>();

        FakeProcessed() {
            super(null);
        }

        @Override
        public boolean firstTime(EventEnvelope event) {
            return seen.add(event.eventId());
        }
    }

    private final FakeStock stock = new FakeStock();
    private final FakeProcessed processed = new FakeProcessed();
    private final StockCommandConsumer consumer = new StockCommandConsumer(new StockCommandHandler(processed, stock));

    private static ConsumerRecord<String, String> record(String key, String value) {
        return new ConsumerRecord<>("stock.commands", 0, 0L, key, value);
    }

    /** Đúng dạng bản tin sales-service ghi vào event_outbox (data = ProductStockClient.Request). */
    private static String saleReturnEvent(UUID eventId, UUID docId, UUID productId) {
        return """
                {"eventId":"%s","type":"stock.doc.requested","source":"sales-service","occurredAt":"2026-11-10T03:00:00Z",
                 "data":{"docId":"%s","docType":"SALE_RETURN","docCode":"TH000001","branchId":"00000000-0000-0000-0000-000000000001",
                  "partnerName":"Nguyễn Văn A","userId":"00000000-0000-0000-0000-000000000009","previousDocId":null,
                  "lines":[{"lineId":"00000000-0000-0000-0000-0000000000a1","productId":"%s","unitId":null,"quantity":null,
                   "lotNumber":"LOT-01","baseQuantity":2.000,"expiryDate":null}]}}""".formatted(eventId, docId, productId);
    }

    @Test
    void salesPayloadIsAppliedThroughInternalStockService() {
        UUID docId = UUID.randomUUID();
        UUID productId = UUID.randomUUID();
        consumer.onMessage(record(docId.toString(), saleReturnEvent(UUID.randomUUID(), docId, productId)));

        assertEquals(1, stock.applied.size());
        var req = stock.applied.get(0);
        assertEquals(docId, req.docId());
        assertEquals("SALE_RETURN", req.docType());
        assertEquals("TH000001", req.docCode());
        assertNull(req.previousDocId());
        var line = req.lines().get(0);
        assertEquals(productId, line.productId());
        assertEquals("LOT-01", line.lotNumber());
        assertEquals(0, new BigDecimal("2").compareTo(line.baseQuantity()));
        assertNull(line.expiryDate());
    }

    @Test
    void invoiceCancelPayloadWithNoLines() {
        UUID stockDocId = UUID.randomUUID();
        var data = new StockDocRequest(stockDocId, "SALE_CANCEL", "HD000001", UUID.randomUUID(), "Khách lẻ", UUID.randomUUID(),
                null, List.of());
        consumer.onMessage(record(stockDocId.toString(), EventEnvelope.of("stock.doc.requested", "sales-service", data).toJson()));
        assertEquals(List.of(data), stock.applied);
    }

    @Test
    void redeliveredEventIsAppliedOnce() {
        UUID eventId = UUID.randomUUID();
        UUID docId = UUID.randomUUID();
        String json = saleReturnEvent(eventId, docId, UUID.randomUUID());
        consumer.onMessage(record(docId.toString(), json));
        consumer.onMessage(record(docId.toString(), json));
        assertEquals(1, stock.applied.size());
    }

    @Test
    void malformedOrForeignMessagesAreSkipped() {
        consumer.onMessage(record("k", "{oops"));
        consumer.onMessage(record("k", null));
        consumer.onMessage(record("k", EventEnvelope.of("invoice.completed", "sales-service",
                new StockDocRequest(UUID.randomUUID(), "SALE", null, null, null, null, null, List.of())).toJson()));
        consumer.onMessage(record("k", EventEnvelope.of("stock.doc.requested", "sales-service",
                new StockDocRequest(null, "SALE_CANCEL", null, null, null, null, null, List.of())).toJson()));
        assertTrue(stock.applied.isEmpty());
        assertTrue(processed.seen.isEmpty());
    }

    @Test
    void stockRejectionIsRethrownForRetryThenDlt() {
        var rejection = BusinessException.badRequest("STOCK_DOC_NOT_FOUND", "Không tìm thấy chứng từ kho gốc của HD000001");
        stock.reject = rejection;
        UUID docId = UUID.randomUUID();
        var thrown = assertThrows(BusinessException.class,
                () -> consumer.onMessage(record(docId.toString(), saleReturnEvent(UUID.randomUUID(), docId, UUID.randomUUID()))));
        assertSame(rejection, thrown);
    }

    @Test
    void infrastructureErrorIsRethrown() {
        stock.reject = new IllegalStateException("db down");
        UUID docId = UUID.randomUUID();
        assertThrows(IllegalStateException.class,
                () -> consumer.onMessage(record(docId.toString(), saleReturnEvent(UUID.randomUUID(), docId, UUID.randomUUID()))));
    }

    @Test
    void normalizedDecimalsFromEnvelopeKeepTheirValue() {
        // EventEnvelope (JsonNode) bỏ số 0 cuối: 10.000 → 1E+1, 2.500 → 2.5
        UUID docId = UUID.randomUUID();
        String json = saleReturnEvent(UUID.randomUUID(), docId, UUID.randomUUID()).replace("\"baseQuantity\":2.000", "\"baseQuantity\":1E+1");
        consumer.onMessage(record(docId.toString(), json));
        assertEquals(0, new BigDecimal("10").compareTo(stock.applied.get(0).lines().get(0).baseQuantity()));
        UUID docId2 = UUID.randomUUID();
        consumer.onMessage(record(docId2.toString(), saleReturnEvent(UUID.randomUUID(), docId2, UUID.randomUUID())
                .replace("\"baseQuantity\":2.000", "\"baseQuantity\":0.333")));
        assertEquals(0, new BigDecimal("0.333").compareTo(stock.applied.get(1).lines().get(0).baseQuantity()));
    }

    @Test
    void sampleExpiryDateIsReadAsLocalDate() {
        UUID docId = UUID.randomUUID();
        String json = saleReturnEvent(UUID.randomUUID(), docId, UUID.randomUUID()).replace("\"expiryDate\":null", "\"expiryDate\":\"2027-05-31\"");
        consumer.onMessage(record(docId.toString(), json));
        assertEquals(LocalDate.of(2027, 5, 31), stock.applied.get(0).lines().get(0).expiryDate());
    }
}
