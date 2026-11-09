package com.vaxclinic.sales.invoice.checkout.service;

import com.vaxclinic.sales.invoice.checkout.entity.CheckoutAttempt;
import com.vaxclinic.sales.invoice.checkout.repository.CheckoutAttemptRepository;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.sales.invoice.client.ProductStockClient;
import com.vaxclinic.sales.invoice.checkout.service.CheckoutAttemptRules.ReconcileAction;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Đối soát "kho đã trừ nhưng không có hóa đơn": lần thanh toán PENDING quá 5 phút mà không có hóa đơn → hoàn kho
 * (SALE_CANCEL cùng chứng từ kho, idempotent ở product-service) → COMPENSATED. Máy bán hàng gửi lại cùng id sau đó
 * → round mới với chứng từ kho mới → trừ kho lại đúng 1 lần (xem CheckoutAttemptRules).
 * <p>Chống chạy đua với lần gửi lại / lưu hóa đơn: bước "nhận việc" khóa dòng (FOR UPDATE) và chuyển COMPENSATING;
 * lưu hóa đơn chỉ đánh dấu DONE khi dòng còn PENDING (cùng khóa dòng) → chỉ 1 trong 2 bên thắng.
 */
@Service
public class CheckoutReconciler {

    private static final Logger log = LoggerFactory.getLogger(CheckoutReconciler.class);
    private static final String NOTHING_TO_REVERSE = "STOCK_DOC_NOT_FOUND";

    private final CheckoutAttemptRepository attempts;
    private final ProductStockClient stock;
    private final TransactionTemplate tx;
    private final CheckoutCompensationNotifier notifier;

    public CheckoutReconciler(CheckoutAttemptRepository attempts, ProductStockClient stock, TransactionTemplate tx,
                              CheckoutCompensationNotifier notifier) {
        this.attempts = attempts;
        this.stock = stock;
        this.tx = tx;
        this.notifier = notifier;
    }

    /** 1 lượt đối soát; trả số lần thanh toán đã hoàn kho. */
    public int run() {
        Instant now = Instant.now();
        List<UUID> ids = attempts.openOlderThan(now.minus(CheckoutAttemptRules.STALE_AFTER), 50);
        int compensated = 0;
        for (UUID id : ids) {
            try {
                if (reconcile(id, now)) {
                    compensated++;
                }
            } catch (RuntimeException e) {
                log.warn("Checkout {} reconciliation failed: {}", id, e.getMessage());
            }
        }
        return compensated;
    }

    private boolean reconcile(UUID id, Instant now) {
        CheckoutAttempt claimed = tx.execute(s -> claim(id, now));
        if (claimed == null) {
            return false;
        }
        boolean reversed = true;
        try {
            stock.apply(new ProductStockClient.Request(claimed.stockDocId(), "SALE_CANCEL", claimed.docCode(),
                    claimed.branchId(), claimed.partnerName(), claimed.userId(), null, List.of()));
        } catch (RuntimeException e) {
            if (!(e instanceof BusinessException be && NOTHING_TO_REVERSE.equals(be.getCode()))) {
                // product-service chưa sẵn sàng... → giữ COMPENSATING (máy bán hàng gửi lại nhận 409), lượt sau làm tiếp
                log.warn("Checkout {} stock reversal failed, will retry: {}", id, e.getMessage());
                tx.executeWithoutResult(s -> attempts.setStatus(id, CheckoutAttempt.COMPENSATING, e.getMessage()));
                return false;
            }
            // Kho chưa từng trừ cho chứng từ này (lỗi trước khi tới product-service) → không có gì để hoàn.
            reversed = false;
        }
        tx.executeWithoutResult(s -> attempts.markCompensated(id, claimed.stockDocId()));
        if (reversed) {
            log.warn("Checkout {} ({}) had no invoice after {} -> stock reversed (SALE_CANCEL {})", id, claimed.docCode(),
                    CheckoutAttemptRules.STALE_AFTER, claimed.stockDocId());
            notifier.compensated(claimed); // chỉ báo khi kho thực sự được hoàn; lỗi gửi chỉ log
        }
        return true;
    }

    /** Trong transaction: khóa dòng, quyết định; cần hoàn kho → COMPENSATING và trả dòng, ngược lại null. */
    private CheckoutAttempt claim(UUID id, Instant now) {
        CheckoutAttempt a = attempts.lock(id);
        if (a == null) {
            return null;
        }
        ReconcileAction action = CheckoutAttemptRules.decide(a, attempts.invoiceExists(id), now);
        if (action == ReconcileAction.MARK_DONE) {
            attempts.setStatus(id, CheckoutAttempt.DONE, null);
        }
        if (action != ReconcileAction.COMPENSATE) {
            return null;
        }
        attempts.setStatus(id, CheckoutAttempt.COMPENSATING, null);
        return a;
    }
}
