package com.vaxclinic.identity.hr;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Bảng outbox_cashflows (phiếu chi HR chờ gửi Sổ quỹ). Chỉ truy cập DB. */
@Repository
public class HrCashflowOutboxRepository {

    private final JdbcTemplate jdbc;

    public HrCashflowOutboxRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public void insert(String payloadJson) {
        jdbc.update("insert into outbox_cashflows(id, payload) values (?, ?)", UUID.randomUUID(), payloadJson);
    }

    /** Tối đa 50 bản ghi chưa gửi (id, payload), cũ nhất trước. */
    public List<Map<String, Object>> pending() {
        return jdbc.queryForList("select id, payload from outbox_cashflows where sent_at is null order by created_at limit 50");
    }

    public void markSent(UUID id) {
        jdbc.update("update outbox_cashflows set sent_at = now(), last_error = null where id = ?", id);
    }

    public void markFailed(UUID id, String error) {
        jdbc.update("update outbox_cashflows set attempts = attempts + 1, last_error = ? where id = ?", error, id);
    }
}
