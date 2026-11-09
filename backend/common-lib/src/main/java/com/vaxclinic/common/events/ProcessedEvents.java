package com.vaxclinic.common.events;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Bên nhận bỏ trùng sự kiện (Kafka giao "ít nhất 1 lần"): gọi {@link #firstTime} TRONG transaction xử lý.
 * Lần đầu → true (ghi nhận eventId, commit cùng kết quả xử lý); đã xử lý → false (bỏ qua).
 * Nếu xử lý lỗi và rollback thì eventId cũng không được ghi → lần giao lại xử lý tiếp.
 * Bảng: processed_events(event_id uuid primary key, event_type, processed_at).
 */
public class ProcessedEvents {

    private final JdbcTemplate jdbc;

    public ProcessedEvents(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public boolean firstTime(EventEnvelope event) {
        return jdbc.update("insert into processed_events(event_id, event_type) values (?, ?) on conflict (event_id) do nothing",
                event.eventId(), event.type()) == 1;
    }
}
