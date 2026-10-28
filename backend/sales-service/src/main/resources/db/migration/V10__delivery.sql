-- ===== Giao hàng: đối tác giao hàng, vận đơn, sổ công nợ đối tác, đối soát =====
-- Chưa tích hợp API hãng vận chuyển: partner_type = MANUAL (cập nhật trạng thái tay). Sau này thêm GHN / GHTK...
CREATE SEQUENCE delivery_partner_code_seq START 1; -- DT000001
CREATE SEQUENCE shipment_code_seq START 1;         -- VD000001
CREATE SEQUENCE delivery_settlement_code_seq START 1; -- DS000001

CREATE TABLE delivery_partners (
    id            UUID PRIMARY KEY,
    code          VARCHAR(30) NOT NULL UNIQUE,
    name          VARCHAR(200) NOT NULL,
    phone         VARCHAR(20),
    email         VARCHAR(150),
    address       VARCHAR(300),
    note          TEXT,
    partner_type  VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
    debt          NUMERIC(18, 0) NOT NULL DEFAULT 0, -- = Σ delivery_partner_ledger.amount (> 0: đối tác nợ cửa hàng)
    active        BOOLEAN NOT NULL DEFAULT TRUE,
    created_by    UUID,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1 hóa đơn bán giao hàng = 1 vận đơn. cod_amount = thu hộ (khách cần trả − đã trả).
-- cod_posted / fee_posted: số đã ghi vào sổ công nợ đối tác (NULL = chưa ghi) → đối soát dùng đúng số đã ghi.
CREATE TABLE shipments (
    id                UUID PRIMARY KEY,
    code              VARCHAR(30) NOT NULL UNIQUE,
    invoice_id        UUID NOT NULL UNIQUE REFERENCES invoices (id),
    branch_id         UUID NOT NULL,
    partner_id        UUID NOT NULL REFERENCES delivery_partners (id),
    receiver_name     VARCHAR(200) NOT NULL,
    receiver_phone    VARCHAR(20) NOT NULL,
    receiver_address  VARCHAR(300) NOT NULL,
    area              VARCHAR(150),
    weight_gram       INT CHECK (weight_gram >= 0),
    shipping_fee      NUMERIC(18, 0) NOT NULL DEFAULT 0 CHECK (shipping_fee >= 0),
    fee_payer         VARCHAR(10) NOT NULL DEFAULT 'SHOP', -- SHOP (cửa hàng trả ĐTGH) / CUSTOMER (người nhận trả)
    cod_amount        NUMERIC(18, 0) NOT NULL DEFAULT 0 CHECK (cod_amount >= 0),
    cod_posted        NUMERIC(18, 0),
    fee_posted        NUMERIC(18, 0),
    note              TEXT,
    status            VARCHAR(20) NOT NULL, -- PENDING/PICKING/DELIVERING/DELIVERED/RETURNING/RETURNED/CANCELLED
    return_id         UUID,                 -- phiếu trả hàng tạo khi chuyển hoàn
    settlement_id     UUID,                 -- đã đối soát
    delivered_at      TIMESTAMPTZ,
    created_by        UUID NOT NULL,
    created_by_name   VARCHAR(150) NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_shipments_time ON shipments (created_at DESC);
CREATE INDEX idx_shipments_partner ON shipments (partner_id, status);

CREATE TABLE shipment_status_logs (
    id               UUID PRIMARY KEY,
    shipment_id      UUID NOT NULL REFERENCES shipments (id) ON DELETE CASCADE,
    from_status      VARCHAR(20),
    to_status        VARCHAR(20) NOT NULL,
    note             VARCHAR(500),
    changed_by       UUID NOT NULL,
    changed_by_name  VARCHAR(150) NOT NULL,
    changed_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_shipment_logs ON shipment_status_logs (shipment_id, changed_at);

-- Đối soát (theo danh sách vận đơn) hoặc thanh toán tự do với đối tác → 1 phiếu thu/chi Sổ quỹ (nếu số tiền ≠ 0).
CREATE TABLE delivery_settlements (
    id               UUID PRIMARY KEY,
    code             VARCHAR(30) NOT NULL UNIQUE,
    partner_id       UUID NOT NULL REFERENCES delivery_partners (id),
    branch_id        UUID NOT NULL,
    kind             VARCHAR(20) NOT NULL, -- RECONCILE / RECEIPT / PAYMENT
    cod_total        NUMERIC(18, 0) NOT NULL DEFAULT 0,
    fee_total        NUMERIC(18, 0) NOT NULL DEFAULT 0,
    amount           NUMERIC(18, 0) NOT NULL, -- > 0 đối tác trả cửa hàng, < 0 cửa hàng trả đối tác
    shipment_count   INT NOT NULL DEFAULT 0,
    voucher_id       UUID REFERENCES cash_vouchers (id),
    status           VARCHAR(20) NOT NULL DEFAULT 'COMPLETED', -- COMPLETED / CANCELLED
    note             TEXT,
    created_by       UUID NOT NULL,
    created_by_name  VARCHAR(150) NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    cancelled_at     TIMESTAMPTZ
);

-- Sổ công nợ đối tác: amount > 0 = đối tác nợ cửa hàng (COD đã thu hộ), < 0 = cửa hàng nợ đối tác (phí giao hàng).
CREATE TABLE delivery_partner_ledger (
    id              UUID PRIMARY KEY,
    partner_id      UUID NOT NULL REFERENCES delivery_partners (id),
    branch_id       UUID NOT NULL,
    doc_type        VARCHAR(20) NOT NULL, -- COD / FEE / SETTLEMENT / SETTLEMENT_CANCEL
    doc_id          UUID,
    doc_code        VARCHAR(30),
    amount          NUMERIC(18, 0) NOT NULL,
    balance_after   NUMERIC(18, 0) NOT NULL,
    note            VARCHAR(300),
    occurred_at     TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_partner_ledger ON delivery_partner_ledger (partner_id, occurred_at);
CREATE INDEX idx_partner_ledger_time ON delivery_partner_ledger (doc_type, occurred_at);
