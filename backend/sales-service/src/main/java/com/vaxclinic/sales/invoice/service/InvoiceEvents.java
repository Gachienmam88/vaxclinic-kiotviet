package com.vaxclinic.sales.invoice.service;

import com.vaxclinic.common.events.EventOutbox;
import com.vaxclinic.sales.invoice.entity.Invoice;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * Sự kiện hóa đơn bán → Kafka topic sales.invoice-events (key = id hóa đơn), ghi qua EventOutbox CÙNG transaction
 * với thay đổi hóa đơn. Chỉ khi app.events.enabled=true (có bean EventOutbox); tắt → không làm gì (như trước).
 * Nội dung tối thiểu: bên nhận (integration-service: tự phát hành HĐĐT) tự lấy chi tiết qua GET /internal/invoices/{id}.
 */
@Component
public class InvoiceEvents {

    public static final String TOPIC = "sales.invoice-events";
    public static final String COMPLETED = "invoice.completed";
    public static final String UPDATED = "invoice.updated";
    public static final String CANCELLED = "invoice.cancelled";

    /** data của sự kiện. */
    public record InvoiceEvent(UUID invoiceId, String code, UUID branchId, BigDecimal total, Instant occurredAt) {
    }

    private final ObjectProvider<EventOutbox> outbox;

    public InvoiceEvents(ObjectProvider<EventOutbox> outbox) {
        this.outbox = outbox;
    }

    /** Hóa đơn hoàn thành (lưu lần đầu khi thanh toán — hóa đơn bán luôn tạo ở trạng thái COMPLETED). */
    public void completed(Invoice inv) {
        add(COMPLETED, inv);
    }

    /** Sửa hóa đơn (nội dung, thuế suất dòng, thông tin chung). */
    public void updated(Invoice inv) {
        add(UPDATED, inv);
    }

    public void cancelled(Invoice inv) {
        add(CANCELLED, inv);
    }

    private void add(String type, Invoice inv) {
        EventOutbox o = outbox.getIfAvailable();
        if (o == null) {
            return;
        }
        o.add(TOPIC, inv.getId().toString(), type,
                new InvoiceEvent(inv.getId(), inv.getCode(), inv.getBranchId(), inv.getTotal(), Instant.now()));
    }
}
