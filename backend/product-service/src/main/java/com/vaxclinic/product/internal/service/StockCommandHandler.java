package com.vaxclinic.product.internal.service;

import com.vaxclinic.common.events.EventEnvelope;
import com.vaxclinic.common.events.ProcessedEvents;
import com.vaxclinic.product.internal.service.InternalStockService.StockDocRequest;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Áp dụng 1 yêu cầu kho từ Kafka trong 1 transaction: bỏ trùng theo eventId (processed_events) → cùng
 * {@link InternalStockService#apply} như POST /internal/stock-docs (vốn idempotent theo docId/docType).
 * Lỗi → rollback cả eventId → lần giao lại xử lý tiếp.
 */
@Component
@ConditionalOnProperty(name = "app.events.enabled", havingValue = "true")
public class StockCommandHandler {

    private final ProcessedEvents processed;
    private final InternalStockService stock;

    public StockCommandHandler(ProcessedEvents processed, InternalStockService stock) {
        this.processed = processed;
        this.stock = stock;
    }

    /** @return false nếu sự kiện đã xử lý trước đó (bỏ qua). */
    @Transactional
    public boolean handle(EventEnvelope event, StockDocRequest request) {
        if (!processed.firstTime(event)) {
            return false;
        }
        stock.apply(request);
        return true;
    }
}
