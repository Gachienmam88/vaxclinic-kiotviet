package com.vaxclinic.sales.invoice.checkout;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

/**
 * Quy tắc thuần (không I/O) của checkout_attempts — tách riêng để kiểm thử đơn vị.
 * <p>Vì sao đổi stock_doc_id sau khi hoàn kho: product-service chống trùng theo (doc_id, doc_type). Sau SALE_CANCEL,
 * gửi lại SALE cùng doc_id sẽ nhận kết quả SALE CŨ (đã bị hoàn) mà không trừ kho lần nữa → hóa đơn lưu được nhưng kho
 * không bị trừ. Nên lần thử lại sau khi đã bù dùng doc_id mới suy ra từ (id hóa đơn, round) — vẫn tất định (gửi lại
 * nhiều lần trong cùng round vẫn idempotent), và hóa đơn lưu stock_doc_id của round đó (hủy / sửa hóa đơn dùng đúng nó).
 */
public final class CheckoutAttemptRules {

    /** Lần thanh toán chưa xong quá lâu (lâu hơn nhiều so với timeout gọi kho 10 s) → coi như máy bán hàng đã bỏ. */
    public static final Duration STALE_AFTER = Duration.ofMinutes(5);

    public enum ReconcileAction { NONE, MARK_DONE, COMPENSATE }

    /** Kết quả bắt đầu 1 lần thanh toán: trừ kho bằng stockDocId của round này; reconciling = đang hoàn kho, chưa thử lại được. */
    public record Begin(UUID stockDocId, int round, boolean reconciling) {
    }

    private CheckoutAttemptRules() {
    }

    /** Chứng từ kho của round: round 1 = chính id hóa đơn (tương thích dữ liệu cũ), round n = UUID suy ra. */
    public static UUID stockDocIdFor(UUID invoiceId, int round) {
        return round <= 1 ? invoiceId
                : UUID.nameUUIDFromBytes((invoiceId + ":checkout:" + round).getBytes(StandardCharsets.UTF_8));
    }

    /**
     * existing = dòng hiện có (null = lần đầu). PENDING / FAILED / DONE → giữ chứng từ kho (gửi lại idempotent);
     * COMPENSATED → sang round mới (trừ kho lại thật sự); COMPENSATING → đang hoàn kho, máy bán hàng thử lại sau.
     */
    public static Begin onBegin(UUID invoiceId, CheckoutAttempt existing) {
        if (existing == null) {
            return new Begin(stockDocIdFor(invoiceId, 1), 1, false);
        }
        return switch (existing.status()) {
            case CheckoutAttempt.COMPENSATED -> new Begin(stockDocIdFor(invoiceId, existing.round() + 1), existing.round() + 1, false);
            case CheckoutAttempt.COMPENSATING -> new Begin(existing.stockDocId(), existing.round(), true);
            default -> new Begin(existing.stockDocId(), existing.round(), false);
        };
    }

    /**
     * Việc job đối soát làm với 1 lần thanh toán: đã có hóa đơn → chỉ đánh dấu DONE (tự lành); đang hoàn kho dở →
     * hoàn tiếp (SALE_CANCEL idempotent); PENDING quá {@link #STALE_AFTER} mà không có hóa đơn → hoàn kho.
     */
    public static ReconcileAction decide(CheckoutAttempt a, boolean invoiceExists, Instant now) {
        boolean open = CheckoutAttempt.PENDING.equals(a.status()) || CheckoutAttempt.COMPENSATING.equals(a.status());
        if (!open) {
            return ReconcileAction.NONE;
        }
        if (invoiceExists) {
            return ReconcileAction.MARK_DONE;
        }
        if (CheckoutAttempt.COMPENSATING.equals(a.status())) {
            return ReconcileAction.COMPENSATE;
        }
        return a.updatedAt().isAfter(now.minus(STALE_AFTER)) ? ReconcileAction.NONE : ReconcileAction.COMPENSATE;
    }
}
