-- Bản sao trạng thái HĐĐT (integration-service, sự kiện einvoice.status-changed trên topic einvoice.events).
-- Chỉ để hiển thị / tra cứu nhanh; chặn sửa/hủy hóa đơn đã phát hành vẫn hỏi integration-service trực tiếp.
CREATE TABLE invoice_einvoice_status (
    invoice_id  UUID         PRIMARY KEY,
    status      VARCHAR(20)  NOT NULL,  -- PUBLISHED / FAILED (như einvoice_records.status)
    einvoice_no VARCHAR(20),            -- số HĐĐT (InvNo) khi đã phát hành
    updated_at  TIMESTAMPTZ  NOT NULL,  -- thời điểm đổi trạng thái bên integration (occurredAt của sự kiện)
    event_id    UUID         NOT NULL
);
