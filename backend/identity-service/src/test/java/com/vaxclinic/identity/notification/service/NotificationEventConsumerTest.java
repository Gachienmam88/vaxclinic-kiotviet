package com.vaxclinic.identity.notification.service;

import com.vaxclinic.common.events.EventEnvelope;
import com.vaxclinic.common.notification.NotificationClient;
import com.vaxclinic.common.notification.NotificationClient.Item;
import com.vaxclinic.common.notification.NotificationClient.PublishRequest;
import com.vaxclinic.common.notification.NotificationClient.SyncRequest;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class NotificationEventConsumerTest {

    static class FakeWriter extends NotificationWriter {
        final List<Item> upserted = new ArrayList<>();
        final List<List<String>> syncedTypes = new ArrayList<>();
        final List<List<Item>> syncedItems = new ArrayList<>();

        FakeWriter() {
            super(null);
        }

        @Override
        public void upsert(List<Item> items) {
            upserted.addAll(items);
        }

        @Override
        public void sync(List<String> types, List<Item> items) {
            syncedTypes.add(types);
            syncedItems.add(items);
        }
    }

    private static Item item(String key) {
        return new Item("LOW_STOCK", key, "Sắp hết hàng", "Vắc xin cúm còn 2 liều", "SP001", null, null, "catalog.view");
    }

    @Test
    void publishUpsertsItems() {
        var writer = new FakeWriter();
        String msg = EventEnvelope.of(NotificationClient.TYPE_PUBLISH, "sales-service", new PublishRequest(List.of(item("a")))).toJson();
        new NotificationEventConsumer(writer).onMessage(msg);
        assertEquals(List.of(item("a")), writer.upserted);
    }

    @Test
    void syncReplacesTypes() {
        var writer = new FakeWriter();
        String msg = EventEnvelope.of(NotificationClient.TYPE_SYNC, "product-service",
                new SyncRequest(List.of("LOW_STOCK", "EXPIRY"), List.of(item("b")))).toJson();
        new NotificationEventConsumer(writer).onMessage(msg);
        assertEquals(List.of(List.of("LOW_STOCK", "EXPIRY")), writer.syncedTypes);
        assertEquals(List.of(List.of(item("b"))), writer.syncedItems);
    }

    @Test
    void emptySyncWithTypesClosesAll() {
        var writer = new FakeWriter();
        String msg = EventEnvelope.of(NotificationClient.TYPE_SYNC, "product-service", new SyncRequest(List.of("LOW_STOCK"), null)).toJson();
        new NotificationEventConsumer(writer).onMessage(msg);
        assertEquals(List.of(List.of()), writer.syncedItems);
    }

    @Test
    void malformedAndUnknownAreSkipped() {
        var writer = new FakeWriter();
        var consumer = new NotificationEventConsumer(writer);
        consumer.onMessage("{bad");
        consumer.onMessage(EventEnvelope.of("notification.other", "x", List.of()).toJson());
        assertTrue(writer.upserted.isEmpty());
        assertTrue(writer.syncedTypes.isEmpty());
    }
}
