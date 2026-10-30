package com.vaxclinic.integration.inputinvoice;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Date;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Lịch sử đồng bộ hóa đơn đầu vào từ cổng thuế (input_invoice_sync_logs). */
@Repository
public class InputInvoiceSyncLogRepository {

    public record SyncLog(UUID id, String taxCode, LocalDate from, LocalDate to, String status, int found, int added,
                          String error, String userName, Instant createdAt) {
    }

    private final JdbcTemplate jdbc;

    public InputInvoiceSyncLogRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public void insert(UUID connectionId, String taxCode, LocalDate from, LocalDate to, boolean ok, int found, int added,
                       String error, UUID userId, String userName) {
        jdbc.update("""
                insert into input_invoice_sync_logs(id, connection_id, tax_code, from_date, to_date, status, found, added, error,
                  user_id, user_name) values (?,?,?,?,?,?,?,?,?,?,?)""", UUID.randomUUID(), connectionId, taxCode,
                Date.valueOf(from), Date.valueOf(to), ok ? "SUCCESS" : "FAILED", found, added, error, userId, userName);
    }

    public List<SyncLog> latest(int limit) {
        return jdbc.query("select * from input_invoice_sync_logs order by created_at desc limit ?", (rs, n) -> new SyncLog(
                rs.getObject("id", UUID.class), rs.getString("tax_code"), rs.getDate("from_date").toLocalDate(),
                rs.getDate("to_date").toLocalDate(), rs.getString("status"), rs.getInt("found"), rs.getInt("added"),
                rs.getString("error"), rs.getString("user_name"), rs.getTimestamp("created_at").toInstant()), limit);
    }
}
