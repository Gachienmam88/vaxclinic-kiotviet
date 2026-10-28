-- ===== Đặt hàng (DH) =====
-- Không trừ kho. Tiền khách đặt cọc = phiếu thu Sổ quỹ (source_type ORDER), giảm công nợ khách ngay khi thu.
-- "Tạo hóa đơn": hóa đơn bán thường (trừ kho) mang order_id, tiền cọc được phân bổ vào hóa đơn.
CREATE SEQUENCE order_code_seq START 1; -- DH000001

CREATE TABLE customer_orders (
    id               UUID PRIMARY KEY,         -- máy bán hàng sinh → gửi lại không tạo trùng
    code             VARCHAR(30) NOT NULL UNIQUE,
    branch_id        UUID NOT NULL,
    customer_id      UUID NOT NULL REFERENCES customers (id),
    customer_name    VARCHAR(200) NOT NULL,
    seller_id        UUID,
    seller_name      VARCHAR(150),
    created_by       UUID NOT NULL,
    created_by_name  VARCHAR(150) NOT NULL,
    ordered_at       TIMESTAMPTZ NOT NULL,
    status           VARCHAR(20) NOT NULL,      -- DRAFT (Phiếu tạm) / CONFIRMED / COMPLETED / CANCELLED
    subtotal         NUMERIC(18, 0) NOT NULL,   -- tổng tiền hàng
    discount         NUMERIC(18, 0) NOT NULL DEFAULT 0,
    total            NUMERIC(18, 0) NOT NULL,   -- khách cần trả
    deposit          NUMERIC(18, 0) NOT NULL DEFAULT 0, -- khách đã trả (Σ phiếu thu đặt cọc còn hiệu lực − đã hoàn)
    note             TEXT,
    invoice_id       UUID REFERENCES invoices (id),
    cancelled_at     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_customer_orders_time ON customer_orders (ordered_at DESC);
CREATE INDEX idx_customer_orders_customer ON customer_orders (customer_id);

CREATE TABLE customer_order_lines (
    id            UUID PRIMARY KEY,
    order_id      UUID NOT NULL REFERENCES customer_orders (id) ON DELETE CASCADE,
    line_no       INT NOT NULL,
    product_id    UUID NOT NULL,
    unit_id       UUID NOT NULL,
    product_code  VARCHAR(50)  NOT NULL,
    product_name  VARCHAR(250) NOT NULL,
    unit_name     VARCHAR(50)  NOT NULL,
    quantity      NUMERIC(18, 3) NOT NULL,
    unit_price    NUMERIC(18, 2) NOT NULL,
    discount      NUMERIC(18, 2) NOT NULL DEFAULT 0, -- giảm giá / 1 đơn vị
    note          VARCHAR(500),
    tax_code      VARCHAR(30)
);
CREATE INDEX idx_customer_order_lines_order ON customer_order_lines (order_id);

-- Hóa đơn tạo từ đơn đặt hàng (1 đơn → tối đa 1 hóa đơn còn hiệu lực).
ALTER TABLE invoices ADD COLUMN order_id UUID REFERENCES customer_orders (id);
CREATE INDEX idx_invoices_order ON invoices (order_id);
