package com.vaxclinic.sales.invoice.checkout;

import java.time.Instant;
import java.util.UUID;

/** Một dòng checkout_attempts (xem V14__checkout_attempts.sql). */
public record CheckoutAttempt(UUID id, UUID stockDocId, int round, String status, UUID branchId, String docCode,
                              String partnerName, UUID userId, Instant updatedAt) {

    public static final String PENDING = "PENDING";
    public static final String DONE = "DONE";
    public static final String FAILED = "FAILED";
    public static final String COMPENSATING = "COMPENSATING";
    public static final String COMPENSATED = "COMPENSATED";
}
