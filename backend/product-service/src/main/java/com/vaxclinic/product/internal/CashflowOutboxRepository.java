package com.vaxclinic.product.internal;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Bảng outbox_cashflows (phiếu chi chờ gửi Sổ quỹ). Chỉ truy cập DB; ghi theo transaction của nơi gọi. */
@Repository
public class CashflowOutboxRepository {

    private final JdbcTemplate jdbc;

    public CashflowOutboxRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public void insert(String payload) {
        jdbc.update("insert into outbox_cashflows(id, payload) values (?, ?)", UUID.randomUUID(), payload);
    }

    /** Tối đa 50 bản ghi chưa gửi, cũ trước: cột id, payload. */
    public List<Map<String, Object>> pending() {
        return jdbc.queryForList(
                "select id, payload from outbox_cashflows where sent_at is null order by created_at limit 50");
    }

    public void markSent(UUID id) {
        jdbc.update("update outbox_cashflows set sent_at = now(), last_error = null where id = ?", id);
    }

    public void markFailed(UUID id, String error) {
        jdbc.update("update outbox_cashflows set attempts = attempts + 1, last_error = ? where id = ?", error, id);
    }
}
