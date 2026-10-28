-- Chứng từ kho do service khác gửi sang (bán hàng, hủy hóa đơn, khách trả hàng).
-- (doc_id, doc_type) duy nhất => gọi lại (retry / đồng bộ offline) không trừ kho 2 lần.
CREATE TABLE external_stock_docs (
    doc_id      UUID        NOT NULL,
    doc_type    VARCHAR(30) NOT NULL,
    doc_code    VARCHAR(50) NOT NULL,
    result      TEXT        NOT NULL,   -- JSON kết quả trả về lần đầu (giá vốn + lô đã phân bổ)
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (doc_id, doc_type)
);

-- Outbox: phiếu chi trả NCC cần ghi sang Sổ quỹ (sales-service). Gửi lại tới khi thành công.
CREATE TABLE outbox_cashflows (
    id           UUID PRIMARY KEY,
    payload      TEXT        NOT NULL,
    attempts     INT         NOT NULL DEFAULT 0,
    last_error   TEXT,
    sent_at      TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_outbox_cashflows_pending ON outbox_cashflows (created_at) WHERE sent_at IS NULL;
