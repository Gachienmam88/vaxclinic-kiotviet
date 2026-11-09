package com.vaxclinic.sales.invoice.client;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.vaxclinic.common.events.EventEnvelope;
import com.vaxclinic.common.events.EventOutbox;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.support.StaticListableBeanFactory;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.SimpleTransactionStatus;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class StockCommandOutboxTest {

    /** Outbox giả: ghi lại (topic, key, type, data) thay vì insert event_outbox. */
    static class FakeOutbox extends EventOutbox {
        record Added(String topic, String key, String type, Object data) {
        }

        final List<Added> added = new ArrayList<>();

        FakeOutbox() {
            super(null, "sales-service");
        }

        @Override
        public EventEnvelope add(String topic, String key, String type, Object data) {
            added.add(new Added(topic, key, type, data));
            return EventEnvelope.of(type, "sales-service", data);
        }
    }

    /** Transaction giả: đếm commit / rollback. */
    static class CountingTx implements PlatformTransactionManager {
        int commits;
        int rollbacks;

        @Override
        public TransactionStatus getTransaction(TransactionDefinition definition) {
            return new SimpleTransactionStatus();
        }

        @Override
        public void commit(TransactionStatus status) {
            commits++;
        }

        @Override
        public void rollback(TransactionStatus status) {
            rollbacks++;
        }
    }

    private final CountingTx txManager = new CountingTx();

    private StockCommandOutbox commands(EventOutbox outbox) {
        var beans = outbox == null ? new StaticListableBeanFactory() : new StaticListableBeanFactory(Map.of("eventOutbox", outbox));
        return new StockCommandOutbox(beans.getBeanProvider(EventOutbox.class), new TransactionTemplate(txManager));
    }

    private static ProductStockClient.Request returnRequest() {
        return new ProductStockClient.Request(UUID.randomUUID(), "SALE_RETURN", "TH000001", UUID.randomUUID(), "Nguyễn Văn A",
                UUID.randomUUID(), null, List.of(new ProductStockClient.Line(UUID.randomUUID(), UUID.randomUUID(), null, null,
                "LOT-01", new BigDecimal("2.000"), LocalDate.of(2027, 5, 31))));
    }

    @Test
    void eventsOffMeansHttpPath() {
        assertThat(commands(null).enabled()).isFalse();
    }

    @Test
    void persistedChangeWritesOneEventKeyedByDocIdInSameTransaction() {
        var outbox = new FakeOutbox();
        var commands = commands(outbox);
        var req = returnRequest();

        assertThat(commands.enabled()).isTrue();
        commands.persistThenRequest(req, () -> true);

        assertThat(outbox.added).hasSize(1);
        var a = outbox.added.get(0);
        assertThat(a.topic()).isEqualTo("stock.commands");
        assertThat(a.key()).isEqualTo(req.docId().toString());
        assertThat(a.type()).isEqualTo("stock.doc.requested");
        assertThat(a.data()).isSameAs(req);
        assertThat(txManager.commits).isEqualTo(1);
    }

    @Test
    void alreadyPersistedWritesNoEvent() {
        var outbox = new FakeOutbox();
        commands(outbox).persistThenRequest(returnRequest(), () -> false);
        assertThat(outbox.added).isEmpty();
    }

    @Test
    void persistFailureRollsBackAndWritesNoEvent() {
        var outbox = new FakeOutbox();
        var commands = commands(outbox);
        assertThatThrownBy(() -> commands.persistThenRequest(returnRequest(), () -> {
            throw new IllegalStateException("db down");
        })).isInstanceOf(IllegalStateException.class);
        assertThat(outbox.added).isEmpty();
        assertThat(txManager.rollbacks).isEqualTo(1);
    }

    @Test
    void eventDataIsTheSameJsonAsTheHttpBody() throws Exception {
        var req = returnRequest();
        // RestClient của Spring Boot: Jackson + JavaTimeModule, ngày dạng ISO
        var http = new ObjectMapper().findAndRegisterModules().disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        var event = EventEnvelope.fromJson(EventEnvelope.of("stock.doc.requested", "sales-service", req).toJson());
        var body = http.readTree(http.writeValueAsString(req));
        // Cùng trường, cùng giá trị; số so theo giá trị (JsonNode của envelope bỏ số 0 cuối: 2.000 → 2)
        java.util.Comparator<com.fasterxml.jackson.databind.JsonNode> sameValue = (a, b) -> a.isNumber() && b.isNumber()
                ? a.decimalValue().compareTo(b.decimalValue()) : a.equals(b) ? 0 : 1;
        assertThat(event.data().equals(sameValue, body)).as("%s vs %s", event.data(), body).isTrue();
        assertThat(http.treeToValue(event.data(), ProductStockClient.Request.class).lines().get(0).baseQuantity())
                .isEqualByComparingTo("2");
        assertThat(event.data().get("lines").get(0).get("expiryDate").asText()).isEqualTo("2027-05-31");
    }
}
