package com.vaxclinic.common.audit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.DisposableBean;
import org.springframework.kafka.core.KafkaTemplate;

import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

/**
 * Gửi lịch sử thao tác vào Kafka topic {@link AuditMessage#TOPIC}; identity-service đọc và ghi DB.
 * <ul>
 *   <li>Không chặn nghiệp vụ: việc gửi chạy trên 1 luồng nền (hàng đợi 10.000, đầy thì bỏ bản cũ nhất — như HttpAuditLogger).</li>
 *   <li>Kafka lỗi / không xác nhận trong delivery.timeout → chuyển sang {@code fallback} (HTTP, có hàng đợi + gửi lại).</li>
 *   <li>Tắt service: chờ gửi nốt hàng đợi rồi flush producer (tối đa ~10 giây).</li>
 * </ul>
 * Khóa bản tin = userId (giữ thứ tự thao tác của cùng 1 người trong 1 partition).
 */
public class KafkaAuditLogger implements AuditLogger, DisposableBean {

    private static final Logger log = LoggerFactory.getLogger(KafkaAuditLogger.class);
    private static final int CAPACITY = 10_000;

    private final KafkaTemplate<String, String> kafka;
    private final AuditLogger fallback;
    private final String source;
    private final ThreadPoolExecutor sender;

    public KafkaAuditLogger(KafkaTemplate<String, String> kafka, AuditLogger fallback, String source) {
        this.kafka = kafka;
        this.fallback = fallback;
        this.source = source;
        this.sender = new ThreadPoolExecutor(1, 1, 0, TimeUnit.SECONDS, new ArrayBlockingQueue<>(CAPACITY), r -> {
            Thread t = new Thread(r, "audit-kafka-sender");
            t.setDaemon(true);
            return t;
        }, new ThreadPoolExecutor.DiscardOldestPolicy());
    }

    @Override
    public void record(AuditEvent event) {
        sender.execute(() -> send(event));
    }

    private void send(AuditEvent event) {
        AuditMessage msg = AuditMessage.of(source, event);
        try {
            String key = event.userId() == null ? null : event.userId().toString();
            kafka.send(AuditMessage.TOPIC, key, msg.toJson()).whenComplete((result, ex) -> {
                if (ex != null) {
                    fallBack(event, ex);
                }
            });
        } catch (RuntimeException ex) {
            // send() ném ngay khi không lấy được metadata trong max.block.ms (Kafka chết lúc khởi động...)
            fallBack(event, ex);
        }
    }

    private void fallBack(AuditEvent event, Throwable ex) {
        log.warn("Kafka audit send failed, falling back to HTTP: {}", ex.getMessage());
        try {
            fallback.record(event);
        } catch (RuntimeException e) {
            log.warn("Audit fallback failed: {}", e.getMessage());
        }
    }

    @Override
    public void destroy() throws InterruptedException {
        sender.shutdown();
        if (!sender.awaitTermination(5, TimeUnit.SECONDS)) {
            log.warn("Audit Kafka sender still had {} events at shutdown", sender.getQueue().size());
        }
        try {
            kafka.flush();
            kafka.getProducerFactory().reset(); // đóng producer
        } catch (RuntimeException e) {
            log.warn("Cannot flush audit Kafka producer at shutdown: {}", e.getMessage());
        }
    }
}
