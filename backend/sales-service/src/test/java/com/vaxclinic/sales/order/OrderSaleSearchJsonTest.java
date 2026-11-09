package com.vaxclinic.sales.order;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vaxclinic.sales.order.OrderSaleSearchQuery.Page;
import com.vaxclinic.sales.order.OrderSaleSearchQuery.SaleOrderItem;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** GET /api/orders/sale-search: record thay Map {items, total}. */
class OrderSaleSearchJsonTest {

    private final ObjectMapper json = new ObjectMapper().findAndRegisterModules();

    private JsonNode tree(Object o) {
        return json.valueToTree(o);
    }

    @Test
    void pageMatchesPreviousMap() {
        var items = List.of(new SaleOrderItem(UUID.randomUUID(), "DH000001", Instant.parse("2026-11-01T01:02:03Z"), "Nguyễn Văn A",
                new BigDecimal("120000"), "DRAFT", null));
        var after = tree(new Page(items, 1L));
        assertThat(after).isEqualTo(tree(Map.of("items", items, "total", 1L)));
        assertThat(after.get("items").get(0).get("note").isNull()).isTrue();
    }
}
