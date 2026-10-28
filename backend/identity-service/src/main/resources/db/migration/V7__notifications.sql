-- Hộp thư đến: cảnh báo tự sinh (category ALERT, các service gửi qua /internal/notifications) và
-- thông báo nội bộ do người có quyền settings.manage viết (category UPDATE, type ANNOUNCEMENT).
CREATE TABLE notifications (
    id              BIGSERIAL PRIMARY KEY,
    category        VARCHAR(10)  NOT NULL,          -- ALERT / UPDATE
    type            VARCHAR(30)  NOT NULL,          -- LOT_EXPIRING, LOW_STOCK, ORDER_DUE, ANNOUNCEMENT...
    dedupe_key      VARCHAR(200),                   -- đối tượng cảnh báo; NULL với thông báo nội bộ
    title           VARCHAR(300) NOT NULL,
    body            TEXT,
    doc_code        VARCHAR(50),                    -- mã hàng / chứng từ → giao diện dựng link
    link            VARCHAR(500),
    branch_id       UUID,                           -- NULL = mọi chi nhánh
    permission      VARCHAR(50),                    -- quyền cần có để thấy; NULL = mọi người
    created_by      UUID,
    created_by_name VARCHAR(150),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    resolved_at     TIMESTAMPTZ                     -- cảnh báo không còn đúng → ẩn khỏi hộp thư
);
CREATE INDEX idx_notifications_time ON notifications (created_at DESC);
CREATE INDEX idx_notifications_key ON notifications (dedupe_key, created_at DESC);
CREATE INDEX idx_notifications_open_type ON notifications (type) WHERE resolved_at IS NULL;

CREATE TABLE notification_reads (
    notification_id BIGINT      NOT NULL REFERENCES notifications (id) ON DELETE CASCADE,
    user_id         UUID        NOT NULL,
    read_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (notification_id, user_id)
);
CREATE INDEX idx_notification_reads_user ON notification_reads (user_id);
