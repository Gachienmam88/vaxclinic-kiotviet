package com.vaxclinic.common.events;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class EventEnvelopeTest {

    record Line(UUID productId, BigDecimal quantity) {
    }

    @Test
    void roundTripKeepsDecimalsExactly() {
        var line = new Line(UUID.randomUUID(), new BigDecimal("10.000"));
        String json = EventEnvelope.of("stock.doc.requested", "sales-service", line).toJson();
        assertTrue(json.contains("\"quantity\":10.000"), json);
        var back = EventEnvelope.fromJson(json);
        assertEquals("stock.doc.requested", back.type());
        assertEquals(line, back.data(Line.class));
    }

    @Test
    void rejectsMalformed() {
        assertThrows(IllegalArgumentException.class, () -> EventEnvelope.fromJson("{oops"));
        assertThrows(IllegalArgumentException.class, () -> EventEnvelope.fromJson("{\"type\":\"x\"}"));
    }
}
