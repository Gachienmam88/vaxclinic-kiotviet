package com.vaxclinic.integration.storeprofile;

import com.vaxclinic.integration.storeprofile.EInvoicePackageAllocator.Pkg;
import com.vaxclinic.integration.storeprofile.EInvoicePackageAllocator.PkgUsage;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;

class EInvoicePackageAllocatorTest {

    private static final LocalDate D = LocalDate.of(2026, 10, 29);

    private static PkgUsage byName(List<PkgUsage> list, String name) {
        return list.stream().filter(p -> p.name().equals(name)).findFirst().orElseThrow();
    }

    @Test
    void allocatesByDateIntoSoonestExpiringPackageThenOverflowsAndCountsUnallocated() {
        var old = new Pkg(UUID.randomUUID(), "old", 10, D.minusDays(60), D.minusDays(31));
        var a = new Pkg(UUID.randomUUID(), "a", 5, D.minusDays(30), D.plusDays(10));
        var b = new Pkg(UUID.randomUUID(), "b", 100, D.minusDays(30), D.plusDays(300));
        var future = new Pkg(UUID.randomUUID(), "future", 50, D.plusDays(11), D.plusDays(400));
        var r = EInvoicePackageAllocator.allocate(List.of(old, a, b, future),
                Map.of(D.minusDays(40), 12L, D.minusDays(5), 8L, D.minusDays(100), 3L), D);
        assertEquals(10, byName(r.packages(), "old").used());          // 12 on day -40, capped at 10
        assertEquals(5, byName(r.packages(), "a").used());             // expires first → filled first
        assertEquals(3, byName(r.packages(), "b").used());             // overflow of day -5
        assertEquals(0, byName(r.packages(), "future").used());
        assertEquals(2 + 3, r.unallocated());                          // 2 over "old" + 3 before any package
        assertEquals("EXPIRED", byName(r.packages(), "old").status());
        assertEquals("ACTIVE", byName(r.packages(), "a").status());
        assertEquals("NOT_STARTED", byName(r.packages(), "future").status());
        assertEquals(97, byName(r.packages(), "b").remaining());
    }
}
