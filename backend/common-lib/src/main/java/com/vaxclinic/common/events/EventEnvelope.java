package com.vaxclinic.common.events;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.cfg.JsonNodeFeature;

import java.time.Instant;
import java.util.UUID;

/**
 * Vỏ chung của mọi sự kiện nghiệp vụ trên Kafka: eventId (bên nhận dùng để bỏ trùng), type (VD "invoice.completed"),
 * source (service phát), occurredAt, data (nội dung riêng của từng loại, JSON).
 */
public record EventEnvelope(UUID eventId, String type, String source, Instant occurredAt, JsonNode data) {

    public static final ObjectMapper JSON = new ObjectMapper().findAndRegisterModules()
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
            // giữ nguyên số thập phân (10.000 không thành 1E+1) khi chuyển data sang JsonNode
            .configure(JsonNodeFeature.STRIP_TRAILING_BIGDECIMAL_ZEROES, false)
            .enable(DeserializationFeature.USE_BIG_DECIMAL_FOR_FLOATS); // đọc lại cũng chính xác (không qua double)

    public static EventEnvelope of(String type, String source, Object data) {
        return new EventEnvelope(UUID.randomUUID(), type, source, Instant.now(), JSON.valueToTree(data));
    }

    public String toJson() {
        try {
            return JSON.writeValueAsString(this);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Cannot serialize event " + type, e);
        }
    }

    /** Ném IllegalArgumentException nếu bản tin hỏng (không đọc được / thiếu eventId, type). */
    public static EventEnvelope fromJson(String json) {
        try {
            EventEnvelope e = JSON.readValue(json, EventEnvelope.class);
            if (e.eventId() == null || e.type() == null) {
                throw new IllegalArgumentException("Event missing eventId/type");
            }
            return e;
        } catch (JsonProcessingException ex) {
            throw new IllegalArgumentException("Malformed event: " + ex.getOriginalMessage(), ex);
        }
    }

    /** Đọc data thành kiểu cụ thể (VD record payload). */
    public <T> T data(Class<T> type) {
        try {
            return JSON.treeToValue(data, type);
        } catch (JsonProcessingException ex) {
            throw new IllegalArgumentException("Malformed " + this.type + " data: " + ex.getOriginalMessage(), ex);
        }
    }
}
