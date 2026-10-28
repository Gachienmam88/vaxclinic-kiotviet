-- ===== Mua hàng: nhà cung cấp, phiếu nhập, trả hàng nhập =====

CREATE SEQUENCE supplier_code_seq START 1;         -- NCC000001
CREATE SEQUENCE purchase_receipt_code_seq START 1; -- PN000001
CREATE SEQUENCE purchase_return_code_seq START 1;  -- THN000001

CREATE TABLE suppliers (
    id            UUID PRIMARY KEY,
    code          VARCHAR(30)  NOT NULL UNIQUE,
    name          VARCHAR(250) NOT NULL,
    phone         VARCHAR(20),
    email         VARCHAR(150),
    address       VARCHAR(500),
    province      VARCHAR(100),
    ward          VARCHAR(100),
    group_name    VARCHAR(100),
    note          TEXT,
    company_name  VARCHAR(250),   -- thông tin xuất hóa đơn
    tax_code      VARCHAR(20),
    id_number     VARCHAR(20),    -- CCCD/CMND
    active        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_suppliers_tax_code ON suppliers (tax_code);

-- Trạng thái: DRAFT = phiếu tạm (chưa vào kho), COMPLETED = đã nhập hàng, CANCELLED = đã hủy.
-- Tiền làm tròn đồng (VNĐ). VAT 1 mức cho cả phiếu; vat_rate NULL = không có VAT.
CREATE TABLE purchase_receipts (
    id                UUID PRIMARY KEY,
    code              VARCHAR(30) NOT NULL UNIQUE,
    branch_id         UUID NOT NULL,
    supplier_id       UUID REFERENCES suppliers (id),
    status            VARCHAR(20) NOT NULL,
    received_at       TIMESTAMPTZ NOT NULL,          -- ngày nhập
    created_by        UUID NOT NULL,
    created_by_name   VARCHAR(150) NOT NULL,
    receiver_id       UUID,                          -- người nhập
    receiver_name     VARCHAR(150),
    input_invoice_no  VARCHAR(50),                   -- số hóa đơn đầu vào
    vat_rate          NUMERIC(5, 2),
    subtotal          NUMERIC(18, 0) NOT NULL DEFAULT 0, -- tổng tiền hàng (sau giảm giá dòng)
    discount          NUMERIC(18, 0) NOT NULL DEFAULT 0, -- giảm giá cả phiếu
    vat_amount        NUMERIC(18, 0) NOT NULL DEFAULT 0,
    total             NUMERIC(18, 0) NOT NULL DEFAULT 0, -- tổng cộng = cần trả NCC
    paid_amount       NUMERIC(18, 0) NOT NULL DEFAULT 0, -- tiền đã trả NCC
    payment_method    VARCHAR(20),                   -- CASH, TRANSFER
    note              TEXT,
    completed_at      TIMESTAMPTZ,
    cancelled_at      TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_purchase_receipts_received ON purchase_receipts (received_at DESC);
CREATE INDEX idx_purchase_receipts_supplier ON purchase_receipts (supplier_id);

-- 1 dòng = 1 hàng × 1 đơn vị × (1 lô nếu hàng quản lý lô). Số lượng/giá theo đơn vị đã chọn.
CREATE TABLE purchase_receipt_lines (
    id               UUID PRIMARY KEY,
    receipt_id       UUID NOT NULL REFERENCES purchase_receipts (id) ON DELETE CASCADE,
    line_no          INT NOT NULL,
    product_id       UUID NOT NULL REFERENCES products (id),
    unit_id          UUID NOT NULL REFERENCES product_units (id),
    conversion_rate  NUMERIC(18, 4) NOT NULL,       -- chụp lại tại thời điểm nhập
    quantity         NUMERIC(18, 3) NOT NULL,
    unit_price       NUMERIC(18, 2) NOT NULL,       -- đơn giá chưa VAT
    discount         NUMERIC(18, 2) NOT NULL DEFAULT 0, -- giảm giá / 1 đơn vị
    lot_number       VARCHAR(50),
    expiry_date      DATE
);
CREATE INDEX idx_purchase_receipt_lines_receipt ON purchase_receipt_lines (receipt_id);

CREATE TABLE purchase_returns (
    id                UUID PRIMARY KEY,
    code              VARCHAR(30) NOT NULL UNIQUE,
    branch_id         UUID NOT NULL,
    supplier_id       UUID REFERENCES suppliers (id),
    receipt_id        UUID REFERENCES purchase_receipts (id), -- trả theo phiếu nhập (NULL = trả nhanh)
    status            VARCHAR(20) NOT NULL,
    returned_at       TIMESTAMPTZ NOT NULL,
    created_by        UUID NOT NULL,
    created_by_name   VARCHAR(150) NOT NULL,
    returner_id       UUID,
    returner_name     VARCHAR(150),
    subtotal          NUMERIC(18, 0) NOT NULL DEFAULT 0,
    discount          NUMERIC(18, 0) NOT NULL DEFAULT 0,
    vat_rate          NUMERIC(5, 2),
    vat_amount        NUMERIC(18, 0) NOT NULL DEFAULT 0,
    total             NUMERIC(18, 0) NOT NULL DEFAULT 0, -- NCC cần trả lại
    refund_amount     NUMERIC(18, 0) NOT NULL DEFAULT 0, -- NCC đã trả lại
    note              TEXT,
    completed_at      TIMESTAMPTZ,
    cancelled_at      TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_purchase_returns_returned ON purchase_returns (returned_at DESC);

CREATE TABLE purchase_return_lines (
    id               UUID PRIMARY KEY,
    return_id        UUID NOT NULL REFERENCES purchase_returns (id) ON DELETE CASCADE,
    line_no          INT NOT NULL,
    product_id       UUID NOT NULL REFERENCES products (id),
    unit_id          UUID NOT NULL REFERENCES product_units (id),
    conversion_rate  NUMERIC(18, 4) NOT NULL,
    quantity         NUMERIC(18, 3) NOT NULL,
    unit_price       NUMERIC(18, 2) NOT NULL,       -- giá trả (chưa VAT)
    lot_number       VARCHAR(50)
);
CREATE INDEX idx_purchase_return_lines_return ON purchase_return_lines (return_id);
