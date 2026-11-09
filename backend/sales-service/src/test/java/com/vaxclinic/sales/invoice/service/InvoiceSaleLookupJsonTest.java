package com.vaxclinic.sales.invoice.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vaxclinic.sales.invoice.service.InvoiceSaleLookupQuery.ReturnableItem;
import com.vaxclinic.sales.invoice.service.InvoiceSaleLookupQuery.ReturnablePage;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** GET /api/invoices/returnable: record thay Map {items, total}. */
class InvoiceSaleLookupJsonTest {

    private final ObjectMapper json = new ObjectMapper().findAndRegisterModules();

    private JsonNode tree(Object o) {
        return json.valueToTree(o);
    }

    @Test
    void returnablePageMatchesPreviousMap() {
        var items = List.of(new ReturnableItem(UUID.randomUUID(), "HD000001", Instant.parse("2026-11-01T01:02:03Z"), "Thu ngân",
                "Khách lẻ", new BigDecimal("390000")));
        var after = tree(new ReturnablePage(items, 12L));
        assertThat(after).isEqualTo(tree(Map.of("items", items, "total", 12L)));
        assertThat(after.get("total").isIntegralNumber()).isTrue();
        assertThat(tree(new ReturnablePage(List.of(), 0L)))
                .isEqualTo(tree(Map.of("items", List.of(), "total", 0L)));
    }
}
