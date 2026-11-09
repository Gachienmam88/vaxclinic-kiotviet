package com.vaxclinic.integration.einvoice.dto;

import com.vaxclinic.integration.einvoice.controller.EInvoiceController;
import com.vaxclinic.integration.einvoice.dto.EInvoiceDtos.InvoiceStatus;
import com.vaxclinic.integration.einvoice.dto.EInvoiceDtos.OkResponse;
import com.vaxclinic.integration.einvoice.dto.EInvoiceDtos.PublishedResponse;
import com.vaxclinic.integration.einvoice.dto.EInvoiceDtos.RecordStatus;
import org.junit.jupiter.api.Test;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static com.vaxclinic.integration.JsonShape.assertSameJson;
import static com.vaxclinic.integration.JsonShape.row;

/** JSON của record mới = JSON của Map trả về trước đây (EInvoiceController). */
class EInvoiceDtosJsonTest {

    @Test
    void settingsTest() {
        assertSameJson(Map.of("ok", true), new OkResponse(true));
    }

    @Test
    void published() {
        assertSameJson(Map.of("published", true), new PublishedResponse(true));
        assertSameJson(Map.of("published", false), new PublishedResponse(false));
    }

    @Test
    void statuses() {
        UUID id = UUID.randomUUID();
        assertSameJson(List.of(Map.of("invoiceId", id.toString(), "status", "ACCEPTED")),
                List.of(new InvoiceStatus(id.toString(), "ACCEPTED")));
    }

    @Test
    void byInvoicesRowFull() {
        var r = row("invoice_id", UUID.randomUUID(), "invoice_code", "HD000001", "status", "PUBLISHED", "inv_series", "2C26MAA",
                "inv_no", "00000012", "inv_code", "M2-26-ABC", "inv_date", "2026-10-29", "transaction_id", "TX1",
                "error", null, "updated_at", Timestamp.from(Instant.parse("2026-10-29T03:04:05.123456Z")));
        assertSameJson(List.of(r), List.of(RecordStatus.fromRow(r)));
    }

    @Test
    void byInvoicesRowNulls() {
        var r = row("invoice_id", UUID.randomUUID(), "invoice_code", "HD000002", "status", "FAILED", "inv_series", null,
                "inv_no", null, "inv_code", null, "inv_date", null, "transaction_id", null,
                "error", "MISA báo lỗi 500: x", "updated_at", Timestamp.from(Instant.parse("2026-10-29T03:04:05Z")));
        assertSameJson(r, RecordStatus.fromRow(r));
    }
}
