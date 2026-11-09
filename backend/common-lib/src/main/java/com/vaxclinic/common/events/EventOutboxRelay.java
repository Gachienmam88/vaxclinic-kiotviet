package com.vaxclinic.common.events;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.DisposableBean;
import org.springframework.beans.factory.SmartInitializingSingleton;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.kafka.core.KafkaTemplate;

import java.util.List;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * Gửi event_outbox lên Kafka mỗi giây, theo thứ tự ghi (seq). Chỉ đánh dấu sent_at sau khi Kafka xác nhận (acks=all);
 * lỗi → ghi last_error, dừng lượt này ở bản ghi lỗi (giữ thứ tự), lượt sau gửi tiếp.
 * Giả định 1 instance mỗi service (đúng với triển khai hiện tại); chạy nhiều instance thì cần khóa (VD advisory lock).
 * Bản ghi đã gửi được xóa sau 7 ngày.
 */
public class EventOutboxRelay implements SmartInitializingSingleton, DisposableBean {

    private static final Logger log = LoggerFactory.getLogger(EventOutboxRelay.class);
    private static final int BATCH = 100;

    private final JdbcTemplate jdbc;
    private final KafkaTemplate<String, String> kafka;
    private final ScheduledExecutorService timer = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "event-outbox-relay");
        t.setDaemon(true);
        return t;
    });
    private long lastCleanup;

    public EventOutboxRelay(JdbcTemplate jdbc, KafkaTemplate<String, String> kafka) {
        this.jdbc = jdbc;
        this.kafka = kafka;
    }

    @Override
    public void afterSingletonsInstantiated() {
        timer.scheduleWithFixedDelay(this::safeRun, 5, 1, TimeUnit.SECONDS);
    }

    private record Row(UUID id, String topic, String key, String type, String payload) {
    }

    private void safeRun() {
        try {
            relayOnce();
            cleanup();
        } catch (RuntimeException e) {
            log.warn("Event outbox relay failed: {}", e.getMessage()); // VD DB chưa sẵn sàng — lượt sau thử lại
        }
    }

    /** Gửi 1 lượt; trả về số bản tin đã gửi. */
    public int relayOnce() {
        List<Row> rows = jdbc.query("select id, topic, msg_key, event_type, payload from event_outbox"
                        + " where sent_at is null order by seq limit " + BATCH,
                (rs, i) -> new Row(rs.getObject(1, UUID.class), rs.getString(2), rs.getString(3), rs.getString(4), rs.getString(5)));
        int sent = 0;
        for (Row r : rows) {
            try {
                kafka.send(r.topic(), r.key(), r.payload()).get(35, TimeUnit.SECONDS);
                jdbc.update("update event_outbox set sent_at = now(), last_error = null where id = ?", r.id());
                sent++;
            } catch (Exception e) {
                String msg = e.getCause() != null ? e.getCause().getMessage() : e.getMessage();
                jdbc.update("update event_outbox set attempts = attempts + 1, last_error = ? where id = ?", msg, r.id());
                log.warn("Event {} ({}) not delivered to Kafka yet: {}", r.id(), r.type(), msg);
                break;
            }
        }
        return sent;
    }

    private void cleanup() {
        if (System.currentTimeMillis() - lastCleanup > 3_600_000) {
            lastCleanup = System.currentTimeMillis();
            jdbc.update("delete from event_outbox where sent_at < now() - interval '7 days'");
        }
    }

    @Override
    public void destroy() {
        timer.shutdownNow();
        try {
            kafka.getProducerFactory().reset();
        } catch (RuntimeException e) {
            log.warn("Cannot close outbox Kafka producer: {}", e.getMessage());
        }
    }
}
