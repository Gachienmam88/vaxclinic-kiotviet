package com.vaxclinic.sales.invoice.einvoice;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.UUID;

/**
 * invoice_einvoice_status: bản sao trạng thái HĐĐT nhận qua Kafka — chỉ dùng hiển thị / tra cứu nhanh.
 * Chặn sửa/hủy hóa đơn đã phát hành KHÔNG đọc bảng này (luôn hỏi integration-service, không bao giờ cũ).
 */
@Repository
public class EInvoiceStatusStore {

    private final JdbcTemplate jdbc;

    public EInvoiceStatusStore(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Ghi trạng thái mới; bản tin cũ hơn trạng thái đang lưu (updatedAt nhỏ hơn) thì bỏ qua. */
    public void upsert(UUID invoiceId, String status, String einvoiceNo, Instant updatedAt, UUID eventId) {
        jdbc.update("""
                insert into invoice_einvoice_status(invoice_id, status, einvoice_no, updated_at, event_id) values (?,?,?,?,?)
                on conflict (invoice_id) do update set status = excluded.status, einvoice_no = excluded.einvoice_no,
                  updated_at = excluded.updated_at, event_id = excluded.event_id
                where invoice_einvoice_status.updated_at <= excluded.updated_at""",
                invoiceId, status, einvoiceNo, Timestamp.from(updatedAt), eventId);
    }
}
