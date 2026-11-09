package com.vaxclinic.common.events;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Transactional outbox: ghi sự kiện vào bảng event_outbox CÙNG transaction với nghiệp vụ (bắt buộc đang có transaction),
 * {@link EventOutboxRelay} gửi lên Kafka sau. Nghiệp vụ commit ⇔ sự kiện chắc chắn được gửi (ít nhất 1 lần).
 * Bảng: xem migration "event_outbox" của từng service.
 */
public class EventOutbox {

    private final JdbcTemplate jdbc;
    private final String source;

    public EventOutbox(JdbcTemplate jdbc, String source) {
        this.jdbc = jdbc;
        this.source = source;
    }

    /**
     * @param key  khóa Kafka: các sự kiện cùng key giữ đúng thứ tự (VD id hóa đơn)
     * @param data nội dung (record), serialize JSON
     * @return sự kiện đã ghi (eventId dùng để tra cứu / log)
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public EventEnvelope add(String topic, String key, String type, Object data) {
        EventEnvelope e = EventEnvelope.of(type, source, data);
        jdbc.update("insert into event_outbox(id, topic, msg_key, event_type, payload) values (?, ?, ?, ?, ?)",
                e.eventId(), topic, key, type, e.toJson());
        return e;
    }
}
