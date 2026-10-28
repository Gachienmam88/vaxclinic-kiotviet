package com.vaxclinic.sales.invoice.checkout;

import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/** checkout_attempts trong RAM (cùng ngữ nghĩa các câu SQL của CheckoutAttemptRepository) cho test không cần DB. */
class FakeCheckoutAttemptRepository extends CheckoutAttemptRepository {

    private final Map<UUID, CheckoutAttempt> rows = new LinkedHashMap<>();
    final Set<UUID> invoices = new HashSet<>();

    FakeCheckoutAttemptRepository() {
        super(null);
    }

    CheckoutAttempt get(UUID id) {
        return rows.get(id);
    }

    /** Lùi updated_at để mô phỏng thời gian trôi. */
    void age(UUID id, Duration by) {
        CheckoutAttempt a = rows.get(id);
        put(a, a.status(), a.stockDocId(), a.round(), a.updatedAt().minus(by));
    }

    @Override
    public CheckoutAttempt lock(UUID id) {
        return rows.get(id);
    }

    @Override
    public boolean insertIfAbsent(UUID id, UUID branchId) {
        if (rows.containsKey(id)) {
            return false;
        }
        rows.put(id, new CheckoutAttempt(id, id, 1, CheckoutAttempt.PENDING, branchId, "", null, null, Instant.now()));
        return true;
    }

    @Override
    public void start(UUID id, UUID stockDocId, int round, String docCode, String partnerName, UUID userId,
                      String payloadHash, String summary) {
        CheckoutAttempt a = rows.get(id);
        rows.put(id, new CheckoutAttempt(id, stockDocId, round, CheckoutAttempt.PENDING, a.branchId(), docCode,
                partnerName, userId, Instant.now()));
    }

    @Override
    public boolean markDone(UUID id, UUID stockDocId) {
        CheckoutAttempt a = rows.get(id);
        if (a == null || !a.stockDocId().equals(stockDocId) || !CheckoutAttempt.PENDING.equals(a.status())) {
            return false;
        }
        put(a, CheckoutAttempt.DONE, a.stockDocId(), a.round(), Instant.now());
        invoices.add(id);
        return true;
    }

    @Override
    public void setStatus(UUID id, String status, String error) {
        CheckoutAttempt a = rows.get(id);
        put(a, status, a.stockDocId(), a.round(), Instant.now());
    }

    @Override
    public void markCompensated(UUID id, UUID stockDocId) {
        CheckoutAttempt a = rows.get(id);
        if (a.stockDocId().equals(stockDocId) && CheckoutAttempt.COMPENSATING.equals(a.status())) {
            put(a, CheckoutAttempt.COMPENSATED, a.stockDocId(), a.round(), Instant.now());
        }
    }

    @Override
    public List<UUID> openOlderThan(Instant olderThan, int limit) {
        return rows.values().stream()
                .filter(a -> CheckoutAttempt.PENDING.equals(a.status()) || CheckoutAttempt.COMPENSATING.equals(a.status()))
                .filter(a -> a.updatedAt().isBefore(olderThan))
                .sorted(Comparator.comparing(CheckoutAttempt::updatedAt)).limit(limit).map(CheckoutAttempt::id).toList();
    }

    @Override
    public boolean invoiceExists(UUID id) {
        return invoices.contains(id);
    }

    private void put(CheckoutAttempt a, String status, UUID stockDocId, int round, Instant updatedAt) {
        rows.put(a.id(), new CheckoutAttempt(a.id(), stockDocId, round, status, a.branchId(), a.docCode(),
                a.partnerName(), a.userId(), updatedAt));
    }
}
