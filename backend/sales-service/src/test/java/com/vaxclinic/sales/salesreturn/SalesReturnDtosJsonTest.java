package com.vaxclinic.sales.salesreturn;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vaxclinic.sales.salesreturn.SalesReturnDtos.ListItem;
import com.vaxclinic.sales.salesreturn.SalesReturnDtos.ListPage;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** GET /api/sales-returns: record thay Map {items, total (count(*) → Long), sumTotal (numeric → BigDecimal)}. */
class SalesReturnDtosJsonTest {

    private final ObjectMapper json = new ObjectMapper().findAndRegisterModules();

    private JsonNode tree(Object o) {
        return json.valueToTree(o);
    }

    @Test
    void listPageMatchesPreviousMap() {
        var items = List.of(new ListItem(UUID.randomUUID(), "TH000001", Instant.parse("2026-11-01T01:02:03Z"), null, "Khách lẻ",
                new BigDecimal("100000"), new BigDecimal("5000"), new BigDecimal("95000"), BigDecimal.ZERO, "COMPLETED"));
        var after = tree(new ListPage(items, 1L, new BigDecimal("95000")));
        assertThat(after).isEqualTo(tree(Map.of("items", items, "total", 1L, "sumTotal", new BigDecimal("95000"))));
        assertThat(after.get("items").get(0).get("invoiceCode").isNull()).isTrue();
    }
}
