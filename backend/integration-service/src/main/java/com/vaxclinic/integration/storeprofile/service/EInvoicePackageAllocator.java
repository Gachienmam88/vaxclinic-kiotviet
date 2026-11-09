package com.vaxclinic.integration.storeprofile.service;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Phân bổ HĐĐT đã phát hành vào gói hóa đơn theo ngày phát hành: mỗi ngày (theo thứ tự thời gian) lấp vào gói có hiệu lực
 * ngày đó (start ≤ ngày ≤ end) và còn chỗ, ưu tiên gói hết hạn sớm hơn. Phần không vào được gói nào = "chưa phân bổ".
 * Trạng thái gói: Chưa hiệu lực (hôm nay < start), Đang hiệu lực, Hết hạn (hôm nay > end).
 */
public final class EInvoicePackageAllocator {

    public record Pkg(UUID id, String name, int quantity, LocalDate startDate, LocalDate endDate) {
    }

    /** status: NOT_STARTED / ACTIVE / EXPIRED. */
    public record PkgUsage(UUID id, String name, int quantity, int used, int remaining, LocalDate startDate, LocalDate endDate,
                           String status) {
    }

    public record Result(List<PkgUsage> packages, long unallocated) {
    }

    private EInvoicePackageAllocator() {
    }

    /** publishedByDate: số HĐĐT phát hành theo ngày. */
    public static Result allocate(List<Pkg> packages, Map<LocalDate, Long> publishedByDate, LocalDate today) {
        Map<UUID, Integer> used = new LinkedHashMap<>();
        packages.forEach(p -> used.put(p.id(), 0));
        List<Pkg> byExpiry = packages.stream().sorted(Comparator.comparing(Pkg::endDate).thenComparing(Pkg::startDate)).toList();
        long unallocated = 0;
        for (var day : publishedByDate.entrySet().stream().sorted(Map.Entry.comparingByKey()).toList()) {
            long left = day.getValue();
            for (Pkg p : byExpiry) {
                if (left == 0) {
                    break;
                }
                if (day.getKey().isBefore(p.startDate()) || day.getKey().isAfter(p.endDate())) {
                    continue;
                }
                int take = (int) Math.min(left, p.quantity() - used.get(p.id()));
                used.merge(p.id(), take, Integer::sum);
                left -= take;
            }
            unallocated += left;
        }
        List<PkgUsage> out = packages.stream()
                .sorted(Comparator.comparing(Pkg::startDate).reversed().thenComparing(Pkg::name))
                .map(p -> {
                    int u = used.get(p.id());
                    String status = today.isBefore(p.startDate()) ? "NOT_STARTED" : today.isAfter(p.endDate()) ? "EXPIRED" : "ACTIVE";
                    return new PkgUsage(p.id(), p.name(), p.quantity(), u, p.quantity() - u, p.startDate(), p.endDate(), status);
                }).toList();
        return new Result(out, unallocated);
    }
}
