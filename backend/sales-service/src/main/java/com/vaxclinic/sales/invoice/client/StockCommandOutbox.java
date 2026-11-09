package com.vaxclinic.sales.invoice.client;

import com.vaxclinic.common.events.EventOutbox;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.function.BooleanSupplier;

/**
 * Hoàn kho tin cậy qua Kafka (chỉ khi app.events.enabled=true — có bean EventOutbox):
 * thay vì gọi POST /internal/stock-docs trước khi ghi DB, ghi chứng từ bán hàng + sự kiện "stock.doc.requested"
 * (topic stock.commands, key = docId, data = ĐÚNG {@link ProductStockClient.Request} mà HTTP gửi) trong 1 transaction.
 * product-service đọc topic và áp dụng qua cùng InternalStockService (idempotent theo docId/docType).
 * Chỉ dùng cho thao tác NHẬP LẠI kho (hủy hóa đơn, trả hàng theo hóa đơn) — kho không có lý do từ chối;
 * thao tác trừ kho (bán, sửa hóa đơn, hủy phiếu trả, trả nhanh) vẫn gọi HTTP đồng bộ để báo lỗi ngay cho người dùng.
 * Tắt cờ → {@link #enabled()} = false, nghiệp vụ chạy đường HTTP như cũ.
 */
@Component
public class StockCommandOutbox {

    public static final String TOPIC = "stock.commands";
    public static final String TYPE = "stock.doc.requested";

    private final EventOutbox outbox;
    private final TransactionTemplate tx;

    public StockCommandOutbox(ObjectProvider<EventOutbox> outbox, TransactionTemplate tx) {
        this.outbox = outbox.getIfAvailable();
        this.tx = tx;
    }

    public boolean enabled() {
        return outbox != null;
    }

    /**
     * 1 transaction: persist ghi thay đổi bán hàng (true = vừa ghi thật; false = đã ghi từ trước, VD gửi lại / bấm 2 lần)
     * → true thì ghi sự kiện yêu cầu kho. Lỗi ở bất kỳ bước nào → rollback cả hai, kho không nhận gì.
     */
    public void persistThenRequest(ProductStockClient.Request request, BooleanSupplier persist) {
        tx.executeWithoutResult(s -> {
            if (persist.getAsBoolean()) {
                outbox.add(TOPIC, request.docId().toString(), TYPE, request);
            }
        });
    }
}
