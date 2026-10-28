package com.vaxclinic.sales.invoice.checkout;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Chạy đối soát thanh toán mỗi 5 phút (lượt đầu 1 phút sau khi khởi động). */
@Component
public class CheckoutReconcileScheduler {

    private static final Logger log = LoggerFactory.getLogger(CheckoutReconcileScheduler.class);

    private final CheckoutReconciler reconciler;

    public CheckoutReconcileScheduler(CheckoutReconciler reconciler) {
        this.reconciler = reconciler;
    }

    @Scheduled(initialDelayString = "${app.checkout.reconcile-initial-delay:PT1M}",
            fixedDelayString = "${app.checkout.reconcile-interval:PT5M}")
    public void reconcile() {
        try {
            int n = reconciler.run();
            if (n > 0) {
                log.warn("Checkout reconciliation reversed stock for {} abandoned checkout(s)", n);
            }
        } catch (RuntimeException e) {
            log.warn("Checkout reconciliation failed: {}", e.getMessage());
        }
    }
}
