package com.vaxclinic.sales.invoice.service;

import com.vaxclinic.common.events.EventEnvelope;
import com.vaxclinic.common.events.EventOutbox;
import com.vaxclinic.sales.invoice.entity.Invoice;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.support.StaticListableBeanFactory;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class InvoiceEventsTest {

    record Sent(String topic, String key, String type, Object data) {
    }

    static class FakeOutbox extends EventOutbox {
        final List<Sent> sent = new ArrayList<>();

        FakeOutbox() {
            super(null, "sales-service");
        }

        @Override
        public EventEnvelope add(String topic, String key, String type, Object data) {
            sent.add(new Sent(topic, key, type, data));
            return EventEnvelope.of(type, "sales-service", data);
        }
    }

    private static Invoice invoice() {
        var inv = new Invoice();
        inv.setId(UUID.randomUUID());
        inv.setCode("HD000123");
        inv.setBranchId(UUID.randomUUID());
        inv.setTotal(new BigDecimal("150000"));
        return inv;
    }

    @Test
    void eventsEnabledWritesOutboxKeyedByInvoiceId() {
        var outbox = new FakeOutbox();
        var bf = new StaticListableBeanFactory();
        bf.addBean("eventOutbox", outbox);
        var events = new InvoiceEvents(bf.getBeanProvider(EventOutbox.class));
        Invoice inv = invoice();

        events.completed(inv);
        events.updated(inv);
        events.cancelled(inv);

        assertEquals(List.of("invoice.completed", "invoice.updated", "invoice.cancelled"),
                outbox.sent.stream().map(Sent::type).toList());
        var first = outbox.sent.get(0);
        assertEquals("sales.invoice-events", first.topic());
        assertEquals(inv.getId().toString(), first.key());
        var data = (InvoiceEvents.InvoiceEvent) first.data();
        assertEquals(inv.getId(), data.invoiceId());
        assertEquals("HD000123", data.code());
        assertEquals(inv.getBranchId(), data.branchId());
        assertEquals(0, new BigDecimal("150000").compareTo(data.total()));
        assertTrue(data.occurredAt() != null);
    }

    @Test
    void eventsDisabledDoesNothing() {
        var events = new InvoiceEvents(new StaticListableBeanFactory().getBeanProvider(EventOutbox.class));
        events.completed(invoice()); // không có EventOutbox → không ném lỗi, không ghi gì
    }
}
