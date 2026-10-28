-- ===== Sửa hóa đơn =====
-- revision: tăng mỗi lần sửa (chống 2 người sửa đè nhau); stock_doc_id: chứng từ kho hiện hành ở product-service
-- (lần đầu = id hóa đơn, mỗi lần sửa sinh id mới → SALE_REPLACE hoàn lô cũ + xuất lô mới trong 1 transaction).
ALTER TABLE invoices ADD COLUMN revision INT NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN stock_doc_id UUID;
UPDATE invoices SET stock_doc_id = id WHERE stock_doc_id IS NULL;
ALTER TABLE invoices ALTER COLUMN stock_doc_id SET NOT NULL;

-- Lô đã xuất cho từng dòng hóa đơn (đơn vị cơ bản) → trả hàng hoàn đúng lô đã bán cho khách.
CREATE TABLE invoice_line_lots (
    line_id     UUID NOT NULL REFERENCES invoice_lines (id) ON DELETE CASCADE,
    lot_number  VARCHAR(50) NOT NULL DEFAULT '',  -- '' = hàng không quản lý lô
    base_qty    NUMERIC(18, 3) NOT NULL,
    PRIMARY KEY (line_id, lot_number)
);

-- ===== Trả hàng (khách trả) =====
CREATE SEQUENCE sales_return_code_seq START 1; -- TH000001

CREATE TABLE sales_returns (
    id               UUID PRIMARY KEY,        -- máy bán hàng sinh → gửi lại không tạo trùng
    code             VARCHAR(30) NOT NULL UNIQUE,
    invoice_id       UUID NOT NULL REFERENCES invoices (id),
    branch_id        UUID NOT NULL,
    customer_id      UUID REFERENCES customers (id),
    customer_name    VARCHAR(200),
    created_by       UUID NOT NULL,
    created_by_name  VARCHAR(150) NOT NULL,
    returned_at      TIMESTAMPTZ NOT NULL,
    status           VARCHAR(20) NOT NULL,     -- COMPLETED / CANCELLED
    subtotal         NUMERIC(18, 0) NOT NULL,  -- tổng tiền hàng trả
    discount         NUMERIC(18, 0) NOT NULL DEFAULT 0,
    fee              NUMERIC(18, 0) NOT NULL DEFAULT 0, -- phí trả hàng
    total            NUMERIC(18, 0) NOT NULL,  -- cần trả khách
    refunded         NUMERIC(18, 0) NOT NULL DEFAULT 0, -- đã trả khách (tiền mặt/CK); phần còn lại trừ vào công nợ
    payment_method   VARCHAR(20),
    note             TEXT,
    cancelled_at     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sales_returns_invoice ON sales_returns (invoice_id);
CREATE INDEX idx_sales_returns_time ON sales_returns (returned_at DESC);

CREATE TABLE sales_return_lines (
    id               UUID PRIMARY KEY,
    return_id        UUID NOT NULL REFERENCES sales_returns (id) ON DELETE CASCADE,
    invoice_line_id  UUID NOT NULL REFERENCES invoice_lines (id),
    product_id       UUID NOT NULL,
    product_code     VARCHAR(50)  NOT NULL,
    product_name     VARCHAR(250) NOT NULL,
    unit_name        VARCHAR(50)  NOT NULL,
    quantity         NUMERIC(18, 3) NOT NULL,  -- theo đơn vị trên hóa đơn
    unit_price       NUMERIC(18, 2) NOT NULL,  -- giá trả / đơn vị
    lots             TEXT                      -- lô nhập lại, VD "L1:1"
);
CREATE INDEX idx_sales_return_lines_return ON sales_return_lines (return_id);

CREATE TABLE sales_return_line_lots (
    return_line_id  UUID NOT NULL REFERENCES sales_return_lines (id) ON DELETE CASCADE,
    lot_number      VARCHAR(50) NOT NULL DEFAULT '',
    base_qty        NUMERIC(18, 3) NOT NULL,
    PRIMARY KEY (return_line_id, lot_number)
);
