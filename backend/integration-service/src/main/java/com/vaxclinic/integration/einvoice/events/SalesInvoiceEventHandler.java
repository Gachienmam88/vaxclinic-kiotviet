package com.vaxclinic.integration.einvoice.events;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.common.events.EventEnvelope;
import com.vaxclinic.common.events.ProcessedEvents;
import com.vaxclinic.common.notification.NotificationClient;
import com.vaxclinic.integration.einvoice.service.EInvoiceService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.HttpClientErrorException;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Sự kiện hóa đơn bán → HĐĐT, bỏ trùng theo eventId trong cùng transaction:
 * - invoice.completed: thiết lập "Tự động phát hành HĐĐT khi hoàn thành hóa đơn" bật → phát hành qua ĐÚNG
 *   {@link EInvoiceService#publish} như nút phát hành tay (đã PUBLISHED thì bỏ qua; MISA lỗi → lưu FAILED, không thử lại);
 *   tắt (mặc định) → không làm gì.
 * - invoice.updated / invoice.cancelled: KHÔNG tự hủy / thay thế HĐĐT (quy trình pháp lý, người dùng tự làm trên MISA);
 *   chỉ ghi log. Hóa đơn đã phát hành HĐĐT bị hủy → cảnh báo Hộp thư đến EINVOICE_INVOICE_CANCELLED.
 */
@Component
@ConditionalOnProperty(name = "app.events.enabled", havingValue = "true")
public class SalesInvoiceEventHandler {

    public static final String COMPLETED = "invoice.completed";
    public static final String UPDATED = "invoice.updated";
    public static final String CANCELLED = "invoice.cancelled";

    private static final Logger log = LoggerFactory.getLogger(SalesInvoiceEventHandler.class);

    /** data của sự kiện (sales-service InvoiceEvents.InvoiceEvent). */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record InvoiceEvent(UUID invoiceId, String code, UUID branchId, BigDecimal total, Instant occurredAt) {
    }

    private final ProcessedEvents processed;
    private final EInvoiceService einvoice;
    private final NotificationClient notifications;

    public SalesInvoiceEventHandler(ProcessedEvents processed, EInvoiceService einvoice, NotificationClient notifications) {
        this.processed = processed;
        this.einvoice = einvoice;
        this.notifications = notifications;
    }

    @Transactional
    public void handle(EventEnvelope e, InvoiceEvent d) {
        if (!processed.firstTime(e)) {
            return;
        }
        switch (e.type()) {
            case COMPLETED -> completed(e, d);
            case UPDATED -> updated(d);
            case CANCELLED -> cancelled(d);
            default -> log.debug("Ignoring sales invoice event type {}", e.type());
        }
    }

    private void completed(EventEnvelope e, InvoiceEvent d) {
        if (!einvoice.autoPublish()) {
            log.debug("Invoice {} completed; e-invoice auto publish is off", d.code());
            return;
        }
        try {
            Map<String, Object> rec = einvoice.publish(d.invoiceId());
            log.info("Auto publish e-invoice for invoice {} (event {}): {}", d.code(), e.eventId(), rec.get("status"));
        } catch (BusinessException ex) {
            if ("INVOICE_NOT_PUBLISHABLE".equals(ex.getCode())) { // VD đã hủy trước khi tới lượt
                log.warn("Invoice {} is no longer publishable, auto publish skipped (event {})", d.code(), e.eventId());
                return;
            }
            // VD chưa thiết lập kết nối MISA: lỗi nghiệp vụ, thử lại không khỏi → lưu FAILED như phát hành lỗi, ack
            log.warn("Auto publish e-invoice for invoice {} failed (event {}): {}", d.code(), e.eventId(), ex.getMessage());
            einvoice.recordFailure(d.invoiceId(), d.code(), ex.getMessage());
        } catch (HttpClientErrorException.NotFound ex) {
            throw BusinessException.notFound("INVOICE_NOT_FOUND", "sales-service không có hóa đơn " + d.code() + " (" + d.invoiceId() + ")");
        }
    }

    private void updated(InvoiceEvent d) {
        if (isPublished(d.invoiceId())) {
            log.warn("Invoice {} was edited after its e-invoice was published; e-invoice left unchanged", d.code());
        } else {
            log.debug("Invoice {} updated", d.code());
        }
    }

    private void cancelled(InvoiceEvent d) {
        var rec = einvoice.record(d.invoiceId()).filter(r -> "PUBLISHED".equals(r.get("status")));
        if (rec.isEmpty()) {
            log.debug("Invoice {} cancelled (no published e-invoice)", d.code());
            return;
        }
        Object series = rec.get().get("inv_series");
        Object no = rec.get().get("inv_no");
        String einvoiceNo = no == null ? "" : " " + (series == null ? "" : series + "-") + no;
        log.warn("Invoice {} cancelled but its e-invoice{} is published; e-invoice NOT cancelled automatically", d.code(), einvoiceNo);
        var item = new NotificationClient.Item("EINVOICE_INVOICE_CANCELLED", "einvoice_invoice_cancelled:" + d.invoiceId(),
                "Hóa đơn " + d.code() + " đã hủy nhưng hóa đơn điện tử đã phát hành",
                "Hóa đơn điện tử" + einvoiceNo + " vẫn còn hiệu lực với cơ quan thuế và KHÔNG được hủy tự động. "
                        + "Lập biên bản và hủy / thay thế hóa đơn điện tử trên MISA meInvoice theo quy định.",
                d.code(), null, d.branchId(), "sales.perform");
        if (!notifications.publish(List.of(item))) {
            throw new IllegalStateException("Cannot notify cancelled invoice " + d.code() + " — will retry"); // identity chưa trả lời
        }
    }

    private boolean isPublished(UUID invoiceId) {
        return einvoice.record(invoiceId).map(r -> "PUBLISHED".equals(r.get("status"))).orElse(false);
    }
}
