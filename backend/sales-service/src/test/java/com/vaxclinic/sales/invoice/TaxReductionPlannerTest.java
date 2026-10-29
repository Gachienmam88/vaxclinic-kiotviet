package com.vaxclinic.sales.invoice;

import com.vaxclinic.sales.invoice.InvoiceDtos.LineInput;
import com.vaxclinic.sales.invoice.TaxReductionLookupClient.ProductTax;
import com.vaxclinic.sales.invoice.TaxReductionLookupClient.Sector;
import com.vaxclinic.sales.invoice.TaxReductionLookupClient.TaxSettings;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/** Dòng giảm thuế do server tra (cờ + thuế suất của hàng, thiết lập thuế), bỏ qua cờ taxReducible / taxCode client gửi. */
class TaxReductionPlannerTest {

    private static final Instant IN_WINDOW = Instant.parse("2026-10-30T03:00:00Z");
    private static final UUID CAT_CHILD = UUID.randomUUID();
    private static final UUID CAT_PARENT = UUID.randomUUID();

    private static LineInput line(UUID productId, String clientTaxCode, boolean clientReducible) {
        return new LineInput(productId, UUID.randomUUID(), "SP", "Hàng", "Hộp", BigDecimal.ONE, new BigDecimal("110000"), null, null,
                clientTaxCode, clientReducible);
    }

    private static TaxReductionPlanner planner(List<ProductTax> products, TaxSettings settings) {
        var client = mock(TaxReductionLookupClient.class);
        when(client.products(any(Collection.class))).thenReturn(products);
        when(client.settings()).thenReturn(settings);
        return new TaxReductionPlanner(client);
    }

    private static TaxSettings settings(String method) {
        return new TaxSettings(List.of(new Sector("PHAN_PHOI", BigDecimal.ONE), new Sector("SAN_XUAT", new BigDecimal("3"))),
                "SAN_XUAT", Map.of(CAT_PARENT, "PHAN_PHOI"), method);
    }

    @Test
    void forgedClientFlagsAreIgnoredForDeduction() {
        UUID eligible = UUID.randomUUID();
        UUID notFlagged = UUID.randomUUID();
        UUID vat5 = UUID.randomUUID();
        var p = planner(List.of(new ProductTax(eligible, "VAT10", true, List.of()), new ProductTax(notFlagged, "VAT10", false, List.of()),
                new ProductTax(vat5, "VAT5", true, List.of())), settings("DEDUCTION"));
        // client đánh dấu cả 3 dòng VAT10 + đủ điều kiện
        var plan = p.plan(List.of(line(eligible, "VAT10", true), line(notFlagged, "VAT10", true), line(vat5, "VAT10", true),
                line(UUID.randomUUID(), "VAT10", true)), true, IN_WINDOW);
        assertThat(plan.method()).isEqualTo("DEDUCTION");
        assertThat(plan.eligible()).containsExactly(true, false, false, false);
    }

    @Test
    void directUsesSectorRateOfNearestMappedCategory() {
        UUID mapped = UUID.randomUUID();
        UUID fallback = UUID.randomUUID();
        var p = planner(List.of(new ProductTax(mapped, "HKD_KCT_15", true, List.of(CAT_CHILD, CAT_PARENT)),
                new ProductTax(fallback, null, true, List.of(UUID.randomUUID()))), settings("DIRECT"));
        var plan = p.plan(List.of(line(mapped, "KCT", false), line(fallback, "KCT", false)), true, IN_WINDOW);
        assertThat(plan.method()).isEqualTo("DIRECT");
        assertThat(plan.eligible()).containsExactly(true, true);
        assertThat(plan.directRates().get(0)).isEqualByComparingTo("1"); // nhóm cha gắn PHAN_PHOI 1%
        assertThat(plan.directRates().get(1)).isEqualByComparingTo("3"); // ngành mặc định SAN_XUAT 3%
    }

    @Test
    void offOrOutsideWindowDoesNotCallServices() {
        var client = mock(TaxReductionLookupClient.class);
        var p = new TaxReductionPlanner(client);
        assertThat(p.plan(List.of(line(UUID.randomUUID(), "VAT10", true)), false, IN_WINDOW).any()).isFalse();
        assertThat(p.plan(List.of(line(UUID.randomUUID(), "VAT10", true)), true, Instant.parse("2027-01-01T00:00:00Z")).any()).isFalse();
        verifyNoInteractions(client);
    }
}
