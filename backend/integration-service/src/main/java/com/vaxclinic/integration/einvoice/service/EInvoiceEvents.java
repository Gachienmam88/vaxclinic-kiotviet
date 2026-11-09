package com.vaxclinic.integration.einvoice.service;

import com.vaxclinic.common.events.EventOutbox;
import com.vaxclinic.integration.notification.IntegrationAlertJob;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Instant;
import java.util.UUID;

/**
 * Trạng thái HĐĐT đổi (phát hành tay hoặc tự động) → sự kiện einvoice.status-changed trên topic einvoice.events
 * (key = id hóa đơn bán), ghi qua EventOutbox CÙNG transaction với einvoice_records. Chỉ khi app.events.enabled=true.
 * Sau commit: chạy ngay đồng bộ cảnh báo EINVOICE_FAILED của {@link IntegrationAlertJob} (lỗi → mở cảnh báo,
 * phát hành lại thành công → tự đóng) thay vì chờ lượt quét 15 phút.
 */
@Component
public class EInvoiceEvents {

    private static final Logger log = LoggerFactory.getLogger(EInvoiceEvents.class);

    public static final String TOPIC = "einvoice.events";
    public static final String STATUS_CHANGED = "einvoice.status-changed";

    /** data của einvoice.status-changed. status: PUBLISHED / FAILED (như einvoice_records.status); previousStatus null = lần đầu. */
    public record StatusChanged(UUID invoiceId, String invoiceCode, String status, String previousStatus, String invSeries,
                                String invNo, String invCode, String error, Instant occurredAt) {
    }

    private final ObjectProvider<EventOutbox> outbox;
    private final ObjectProvider<IntegrationAlertJob> alerts;

    public EInvoiceEvents(ObjectProvider<EventOutbox> outbox, ObjectProvider<IntegrationAlertJob> alerts) {
        this.outbox = outbox;
        this.alerts = alerts;
    }

    /** app.events.enabled=true. Tắt → EInvoiceService chạy đúng như trước, không gọi các method dưới. */
    public boolean enabled() {
        return outbox.getIfAvailable() != null;
    }

    /** Gọi TRONG transaction ghi einvoice_records; không đổi trạng thái (VD FAILED → FAILED) thì không phát. */
    public void statusChanged(String previousStatus, UUID invoiceId, String invoiceCode, String status, String invSeries,
                              String invNo, String invCode, String error) {
        EventOutbox o = outbox.getIfAvailable();
        if (o == null || status.equals(previousStatus)) {
            return;
        }
        o.add(TOPIC, invoiceId.toString(), STATUS_CHANGED, new StatusChanged(invoiceId, invoiceCode, status, previousStatus,
                invSeries, invNo, invCode, error, Instant.now()));
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    syncAlerts();
                }
            });
        }
    }

    private void syncAlerts() {
        IntegrationAlertJob job = alerts.getIfAvailable();
        if (job == null) {
            return;
        }
        try {
            job.einvoiceFailures(); // lỗi gọi identity → job 15 phút gửi lại
        } catch (RuntimeException e) {
            log.warn("E-invoice alert sync after status change failed: {}", e.getMessage());
        }
    }
}
