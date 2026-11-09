-- Lịch sử thao tác nhận qua Kafka (giao "ít nhất 1 lần"): event_id để bỏ qua bản tin trùng.
-- Bản ghi cũ / ghi qua HTTP / identity tự ghi có event_id NULL (NULL không bao giờ trùng nhau).
ALTER TABLE audit_logs ADD COLUMN event_id UUID;
CREATE UNIQUE INDEX uq_audit_logs_event_id ON audit_logs (event_id);
