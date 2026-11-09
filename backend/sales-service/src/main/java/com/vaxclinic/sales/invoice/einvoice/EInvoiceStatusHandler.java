package com.vaxclinic.sales.invoice.einvoice;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.vaxclinic.common.events.EventEnvelope;
import com.vaxclinic.common.events.ProcessedEvents;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

/** einvoice.status-changed → invoice_einvoice_status, bỏ trùng theo eventId trong cùng transaction. */
@Component
@ConditionalOnProperty(name = "app.events.enabled", havingValue = "true")
public class EInvoiceStatusHandler {

    public static final String STATUS_CHANGED = "einvoice.status-changed";

    private static final Logger log = LoggerFactory.getLogger(EInvoiceStatusHandler.class);

    /** data của einvoice.status-changed (integration-service EInvoiceEvents.StatusChanged; chỉ đọc các trường cần). */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record StatusChanged(UUID invoiceId, String invoiceCode, String status, String invNo, Instant occurredAt) {
    }

    private final ProcessedEvents processed;
    private final EInvoiceStatusStore store;

    public EInvoiceStatusHandler(ProcessedEvents processed, EInvoiceStatusStore store) {
        this.processed = processed;
        this.store = store;
    }

    @Transactional
    public void handle(EventEnvelope e, StatusChanged d) {
        if (!processed.firstTime(e)) {
            return;
        }
        store.upsert(d.invoiceId(), d.status(), d.invNo(), d.occurredAt() != null ? d.occurredAt() : e.occurredAt(), e.eventId());
        log.info("E-invoice status of invoice {} is now {} (event {})", d.invoiceCode(), d.status(), e.eventId());
    }
}
