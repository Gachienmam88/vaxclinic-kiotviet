package com.vaxclinic.common.audit;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.vaxclinic.common.audit.AuditLogger.AuditEvent;

import java.util.UUID;

/**
 * Bản tin Kafka topic {@value #TOPIC}: 1 sự kiện lịch sử thao tác + eventId để identity-service bỏ qua bản trùng
 * (Kafka giao "ít nhất 1 lần"). JSON, thời gian dạng ISO-8601.
 */
public record AuditMessage(UUID eventId, String source, AuditEvent event) {

    public static final String TOPIC = "audit.events";

    private static final ObjectMapper JSON = new ObjectMapper().findAndRegisterModules()
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    public static AuditMessage of(String source, AuditEvent event) {
        return new AuditMessage(UUID.randomUUID(), source, event);
    }

    public String toJson() {
        try {
            return JSON.writeValueAsString(this);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Cannot serialize audit message", e);
        }
    }

    /** Ném IllegalArgumentException nếu không đọc được (bản tin hỏng). */
    public static AuditMessage fromJson(String json) {
        try {
            AuditMessage m = JSON.readValue(json, AuditMessage.class);
            if (m.eventId() == null || m.event() == null) {
                throw new IllegalArgumentException("Audit message missing eventId/event");
            }
            return m;
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("Malformed audit message: " + e.getOriginalMessage(), e);
        }
    }
}
