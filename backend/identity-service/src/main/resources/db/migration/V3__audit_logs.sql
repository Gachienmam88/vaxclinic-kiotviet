-- Lịch sử thao tác của nhân viên (Thiết lập → Lịch sử thao tác). Các service gửi về qua /internal/audit-logs.
CREATE TABLE audit_logs (
    id          BIGSERIAL PRIMARY KEY,
    occurred_at TIMESTAMPTZ  NOT NULL,
    user_id     UUID,
    user_name   VARCHAR(150),
    branch_id   UUID,
    feature     VARCHAR(50)  NOT NULL,
    action      VARCHAR(30)  NOT NULL,
    doc_code    VARCHAR(50),
    detail      VARCHAR(1000)
);
CREATE INDEX idx_audit_logs_time ON audit_logs (occurred_at DESC);
CREATE INDEX idx_audit_logs_user ON audit_logs (user_id, occurred_at DESC);
