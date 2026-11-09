package com.vaxclinic.sales.invoice.service;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class InvoiceFilterSqlTest {

    private static InvoiceQuery.Filter filter(List<String> deliveries, List<String> returns, List<String> einvoice,
                                              List<String> natures, List<String> states) {
        return new InvoiceQuery.Filter(null, null, null, null, null, null, null, null, null, 0, 15,
                null, states, deliveries, returns, einvoice, natures, null, null, null);
    }

    @Test
    void eitherAddsConditionOnlyWhenOneSideChosen() {
        assertEquals("", InvoiceFilterSql.either(null, "HAS", "NONE", "x"));
        assertEquals("", InvoiceFilterSql.either(List.of("HAS", "NONE"), "HAS", "NONE", "x"));
        assertEquals("", InvoiceFilterSql.either(List.of(), "HAS", "NONE", "x"));
        assertEquals(" and x", InvoiceFilterSql.either(List.of("HAS"), "HAS", "NONE", "x"));
        assertEquals(" and not x", InvoiceFilterSql.either(List.of("NONE"), "HAS", "NONE", "x"));
    }

    @Test
    void deliveryAndReturnFilters() {
        var p = new MapSqlParameterSource();
        String w = InvoiceFilterSql.where(filter(List.of("DELIVERY"), List.of("NONE"), null, null, null), p, null);
        assertTrue(w.contains(" and i.sale_mode = 'DELIVERY'"));
        assertTrue(w.contains(" and not " + InvoiceFilterSql.HAS_RETURN));
    }

    @Test
    void stateFilterUsesDisplayStateExpression() {
        var p = new MapSqlParameterSource();
        String w = InvoiceFilterSql.where(filter(null, null, null, null, List.of("PROCESSING", "FAILED_DELIVERY")), p, null);
        assertTrue(w.contains(InvoiceFilterSql.STATE + " in (:states)"));
        assertEquals(List.of("PROCESSING", "FAILED_DELIVERY"), p.getValue("states"));
    }

    @Test
    void einvoiceClauseHandlesNoneAndEmptyLists() {
        UUID a = UUID.randomUUID();
        UUID b = UUID.randomUUID();
        var p = new MapSqlParameterSource();
        String c = InvoiceFilterSql.einvoiceClause(List.of("NONE", "FAILED", "ACCEPTED"),
                Map.of("PUBLISHED", List.of(a), "FAILED", List.of(b)), p);
        assertEquals(" and (i.id not in (:ei_all) or i.id in (:ei_failed) or false)", c);
        assertTrue(((List<?>) p.getValue("ei_all")).containsAll(List.of(a, b)));

        var p2 = new MapSqlParameterSource();
        assertEquals(" and (true)", InvoiceFilterSql.einvoiceClause(List.of("NONE"), Map.of(), p2));
        assertEquals("", InvoiceFilterSql.einvoiceClause(List.of("BOGUS"), Map.of(), p2));
    }

    @Test
    void natureOriginalMeansPublishedOthersMatchNothing() {
        UUID a = UUID.randomUUID();
        var p = new MapSqlParameterSource();
        String w = InvoiceFilterSql.where(filter(null, null, null, List.of("ORIGINAL"), null), p, Map.of("ACCEPTED", List.of(a)));
        assertTrue(w.endsWith(" and i.id in (:ei_nature)"));
        assertEquals(List.of(a), p.getValue("ei_nature"));
        String w2 = InvoiceFilterSql.where(filter(null, null, null, List.of("ADJUST"), null), new MapSqlParameterSource(), Map.of());
        assertTrue(w2.endsWith(" and false"));
        assertFalse(InvoiceFilterSql.where(filter(null, null, null, null, null), p, null).contains("ei_"));
    }
}
