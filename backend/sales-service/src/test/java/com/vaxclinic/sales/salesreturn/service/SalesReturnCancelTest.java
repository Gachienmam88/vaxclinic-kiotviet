package com.vaxclinic.sales.salesreturn.service;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.common.events.EventEnvelope;
import com.vaxclinic.common.events.EventOutbox;
import com.vaxclinic.common.http.InternalRestClientFactory;
import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.common.SalesRules;
import com.vaxclinic.sales.invoice.client.ProductStockClient;
import com.vaxclinic.sales.invoice.client.StockCommandOutbox;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.support.StaticListableBeanFactory;
import org.springframework.transaction.support.TransactionTemplate;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Hủy phiếu trả (SALE_RETURN_CANCEL) luôn đồng bộ; khi bật sự kiện, phiếu chưa được kho nhập → báo "đang đồng bộ". */
class SalesReturnCancelTest {

    private static final UUID BRANCH = UUID.randomUUID();
    private static final Actor ACTOR = new Actor(UUID.randomUUID(), "Thu ngân", List.of(BRANCH.toString()));

    static class FakeStock extends ProductStockClient {
        final List<Request> calls = new ArrayList<>();
        BusinessException reject;

        FakeStock() {
            super(InternalRestClientFactory.defaults(), Duration.ofSeconds(1), "http://127.0.0.1:9",
                    "test-secret-test-secret-test-secret-0123456789");
        }

        @Override
        public Result apply(Request req) {
            calls.add(req);
            if (reject != null) {
                throw reject;
            }
            return new Result(req.docId(), req.docType(), List.of());
        }
    }

    static class FakeWriter extends SalesReturnWriter {
        final Map<String, Object> row = new HashMap<>();
        final List<UUID> cancelled = new ArrayList<>();

        FakeWriter(UUID id) {
            super(null, null, null, null, null);
            row.put("id", id);
            row.put("status", "COMPLETED");
            row.put("branch_id", BRANCH);
            row.put("code", "TH000007");
            row.put("customer_name", "Khách lẻ");
            row.put("returned_at", Timestamp.from(Instant.now()));
        }

        @Override
        public Map<String, Object> find(UUID id) {
            return row;
        }

        @Override
        public void markCancelled(UUID id) {
            cancelled.add(id);
        }
    }

    static class OpenRules extends SalesRules {
        OpenRules() {
            super(null, null);
        }

        @Override
        public void checkNotLocked(UUID branchId, Instant documentTime) {
        }
    }

    private static StockCommandOutbox commands(boolean events) {
        EventOutbox outbox = new EventOutbox(null, "sales-service") {
            @Override
            public EventEnvelope add(String topic, String key, String type, Object data) {
                throw new AssertionError("hủy phiếu trả không đi Kafka");
            }
        };
        var beans = events ? new StaticListableBeanFactory(Map.of("eventOutbox", outbox)) : new StaticListableBeanFactory();
        return new StockCommandOutbox(beans.getBeanProvider(EventOutbox.class), new TransactionTemplate());
    }

    private static SalesReturnService service(FakeStock stock, FakeWriter writer, boolean events) {
        return new SalesReturnService(null, null, stock, writer, new OpenRules(), null, commands(events));
    }

    @Test
    void cancelStaysSynchronousWhenEventsEnabled() {
        UUID id = UUID.randomUUID();
        var stock = new FakeStock();
        var writer = new FakeWriter(id);
        service(stock, writer, true).cancel(id, ACTOR);
        assertThat(stock.calls).singleElement().satisfies(r -> {
            assertThat(r.docType()).isEqualTo("SALE_RETURN_CANCEL");
            assertThat(r.docId()).isEqualTo(id);
        });
        assertThat(writer.cancelled).containsExactly(id);
    }

    @Test
    void returnNotYetAppliedByStockAsksToRetry() {
        UUID id = UUID.randomUUID();
        var stock = new FakeStock();
        stock.reject = BusinessException.badRequest("STOCK_DOC_NOT_FOUND", "Không tìm thấy chứng từ kho gốc của TH000007");
        var writer = new FakeWriter(id);
        assertThatThrownBy(() -> service(stock, writer, true).cancel(id, ACTOR))
                .isInstanceOfSatisfying(BusinessException.class, e -> {
                    assertThat(e.getCode()).isEqualTo("STOCK_SYNC_PENDING");
                    assertThat(e.getMessage()).contains("TH000007").contains("thử lại");
                });
        assertThat(writer.cancelled).isEmpty();
    }

    @Test
    void eventsOffKeepsOriginalStockError() {
        UUID id = UUID.randomUUID();
        var stock = new FakeStock();
        stock.reject = BusinessException.badRequest("STOCK_DOC_NOT_FOUND", "Không tìm thấy chứng từ kho gốc của TH000007");
        var writer = new FakeWriter(id);
        assertThatThrownBy(() -> service(stock, writer, false).cancel(id, ACTOR))
                .isInstanceOfSatisfying(BusinessException.class, e -> assertThat(e.getCode()).isEqualTo("STOCK_DOC_NOT_FOUND"));
        assertThat(writer.cancelled).isEmpty();
    }

    @Test
    void insufficientStockStillReachesUser() {
        UUID id = UUID.randomUUID();
        var stock = new FakeStock();
        stock.reject = BusinessException.badRequest("INSUFFICIENT_LOT_STOCK", "Lô L1 không đủ tồn");
        var writer = new FakeWriter(id);
        assertThatThrownBy(() -> service(stock, writer, true).cancel(id, ACTOR))
                .isInstanceOfSatisfying(BusinessException.class, e -> assertThat(e.getCode()).isEqualTo("INSUFFICIENT_LOT_STOCK"));
    }
}
