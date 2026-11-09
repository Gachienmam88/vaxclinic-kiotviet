-- Sự kiện nghiệp vụ qua Kafka (common-lib com.vaxclinic.common.events).
-- event_outbox: ghi cùng transaction nghiệp vụ, EventOutboxRelay gửi Kafka theo seq rồi đặt sent_at.
CREATE TABLE event_outbox (
    seq        BIGSERIAL    PRIMARY KEY,
    id         UUID         NOT NULL UNIQUE,
    topic      VARCHAR(100) NOT NULL,
    msg_key    VARCHAR(100),
    event_type VARCHAR(100) NOT NULL,
    payload    TEXT         NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    sent_at    TIMESTAMPTZ,
    attempts   INT          NOT NULL DEFAULT 0,
    last_error TEXT
);
CREATE INDEX idx_event_outbox_pending ON event_outbox (seq) WHERE sent_at IS NULL;

-- processed_events: sự kiện đã xử lý (bỏ trùng khi Kafka giao lại).
CREATE TABLE processed_events (
    event_id     UUID         PRIMARY KEY,
    event_type   VARCHAR(100) NOT NULL,
    processed_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);
