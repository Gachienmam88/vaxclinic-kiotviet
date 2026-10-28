package com.vaxclinic.sales.invoice.checkout;

import com.vaxclinic.sales.invoice.checkout.CheckoutAttemptRules.ReconcileAction;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class CheckoutAttemptRulesTest {

    private static final UUID ID = UUID.randomUUID();
    private static final Instant NOW = Instant.parse("2026-10-29T10:00:00Z");

    private static CheckoutAttempt attempt(String status, int round, Instant updatedAt) {
        return new CheckoutAttempt(ID, CheckoutAttemptRules.stockDocIdFor(ID, round), round, status, UUID.randomUUID(),
                "HD000001", "Khách lẻ", UUID.randomUUID(), updatedAt);
    }

    @Test
    void firstAttemptUsesInvoiceIdAsStockDoc() {
        var b = CheckoutAttemptRules.onBegin(ID, null);
        assertThat(b.stockDocId()).isEqualTo(ID);
        assertThat(b.round()).isEqualTo(1);
        assertThat(b.reconciling()).isFalse();
    }

    @Test
    void retryWhilePendingOrFailedReusesSameStockDoc() {
        for (String status : new String[]{CheckoutAttempt.PENDING, CheckoutAttempt.FAILED}) {
            var b = CheckoutAttemptRules.onBegin(ID, attempt(status, 1, NOW));
            assertThat(b.stockDocId()).isEqualTo(ID);
            assertThat(b.round()).isEqualTo(1);
        }
    }

    @Test
    void retryAfterCompensationStartsNewRoundWithNewDeterministicStockDoc() {
        var b = CheckoutAttemptRules.onBegin(ID, attempt(CheckoutAttempt.COMPENSATED, 1, NOW));
        assertThat(b.round()).isEqualTo(2);
        assertThat(b.stockDocId()).isNotEqualTo(ID).isEqualTo(CheckoutAttemptRules.stockDocIdFor(ID, 2));
        // round 3 after a second compensation differs again
        var b3 = CheckoutAttemptRules.onBegin(ID, attempt(CheckoutAttempt.COMPENSATED, 2, NOW));
        assertThat(b3.stockDocId()).isNotIn(ID, b.stockDocId());
    }

    @Test
    void retryDuringCompensationIsRejected() {
        assertThat(CheckoutAttemptRules.onBegin(ID, attempt(CheckoutAttempt.COMPENSATING, 1, NOW)).reconciling()).isTrue();
    }

    @Test
    void stalePendingWithoutInvoiceIsCompensated() {
        var stale = attempt(CheckoutAttempt.PENDING, 1, NOW.minus(Duration.ofMinutes(6)));
        assertThat(CheckoutAttemptRules.decide(stale, false, NOW)).isEqualTo(ReconcileAction.COMPENSATE);
    }

    @Test
    void recentPendingIsLeftAlone() {
        var recent = attempt(CheckoutAttempt.PENDING, 1, NOW.minus(Duration.ofMinutes(4)));
        assertThat(CheckoutAttemptRules.decide(recent, false, NOW)).isEqualTo(ReconcileAction.NONE);
    }

    @Test
    void pendingWithInvoiceIsHealedNotCompensated() {
        var stale = attempt(CheckoutAttempt.PENDING, 1, NOW.minus(Duration.ofHours(1)));
        assertThat(CheckoutAttemptRules.decide(stale, true, NOW)).isEqualTo(ReconcileAction.MARK_DONE);
    }

    @Test
    void interruptedCompensationIsResumed() {
        var c = attempt(CheckoutAttempt.COMPENSATING, 1, NOW.minus(Duration.ofMinutes(1)));
        assertThat(CheckoutAttemptRules.decide(c, false, NOW)).isEqualTo(ReconcileAction.COMPENSATE);
    }

    @Test
    void finishedAttemptsAreIgnored() {
        Instant old = NOW.minus(Duration.ofDays(1));
        for (String status : new String[]{CheckoutAttempt.DONE, CheckoutAttempt.FAILED, CheckoutAttempt.COMPENSATED}) {
            assertThat(CheckoutAttemptRules.decide(attempt(status, 1, old), false, NOW)).isEqualTo(ReconcileAction.NONE);
        }
    }
}
