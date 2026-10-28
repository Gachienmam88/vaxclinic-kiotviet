-- SePay: báo có giao dịch ngân hàng qua webhook (Thiết lập → Thanh toán).
CREATE TABLE sepay_settings (
    id            INT PRIMARY KEY CHECK (id = 1),
    enabled       BOOLEAN     NOT NULL DEFAULT FALSE,
    api_key_enc   TEXT,                         -- API key SePay gửi kèm webhook, mã hóa AES-GCM
    auto_complete BOOLEAN     NOT NULL DEFAULT TRUE, -- màn bán hàng tự hoàn thành hóa đơn khi nhận đủ tiền
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Yêu cầu thanh toán QR: mã VXC... nằm trong nội dung chuyển khoản để khớp giao dịch.
CREATE TABLE payment_requests (
    code        VARCHAR(20) PRIMARY KEY,
    amount      NUMERIC(18,0) NOT NULL,
    reference   VARCHAR(100),                   -- VD id tab hóa đơn ở màn bán hàng / mã khách thu nợ
    branch_id   UUID,
    status      VARCHAR(10)  NOT NULL DEFAULT 'PENDING', -- PENDING / PAID
    paid_amount NUMERIC(18,0) NOT NULL DEFAULT 0,
    created_by  UUID,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    paid_at     TIMESTAMPTZ
);

-- Giao dịch SePay gửi về (id SePay chống trùng khi SePay gửi lại).
CREATE TABLE bank_transactions (
    sepay_id         BIGINT PRIMARY KEY,
    gateway          VARCHAR(50),
    transaction_date VARCHAR(30),
    account_number   VARCHAR(50),
    transfer_type    VARCHAR(5),
    amount           NUMERIC(18,0) NOT NULL,
    content          VARCHAR(500),
    reference_code   VARCHAR(100),
    payment_code     VARCHAR(20) REFERENCES payment_requests (code),
    received_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_bank_transactions_time ON bank_transactions (received_at DESC);
