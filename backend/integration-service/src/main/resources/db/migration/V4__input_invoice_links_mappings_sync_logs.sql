-- Hóa đơn đầu vào "Đã lập phiếu" trỏ tới phiếu nhập HOẶC phiếu chi (Lập phiếu ▾: phiếu nhập / phiếu chi NCC / phiếu chi Sổ quỹ).
ALTER TABLE input_invoices RENAME COLUMN receipt_id TO link_id;
ALTER TABLE input_invoices RENAME COLUMN receipt_code TO link_code;
ALTER TABLE input_invoices ADD COLUMN link_type VARCHAR(20)
    CHECK (link_type IN ('RECEIPT', 'SUPPLIER_PAYMENT', 'CASH_VOUCHER'));
UPDATE input_invoices SET link_type = 'RECEIPT' WHERE link_id IS NOT NULL;
CREATE INDEX idx_input_invoices_link ON input_invoices (link_id);
-- Thông tin hiển thị "Chi tiết hóa đơn điện tử" (JSON: tên loại HĐ, mã CQT, người bán / người mua mở rộng, chữ ký, tổng theo thuế suất)
ALTER TABLE input_invoices ADD COLUMN details TEXT;

-- Ghi nhớ ánh xạ "hàng trên hóa đơn của NCC" → hàng hóa + đơn vị trong kho (product-service), theo MST người bán.
-- item_key = tên hàng + "|" + ĐVT đã chuẩn hóa (chữ thường, gộp khoảng trắng).
CREATE TABLE input_invoice_item_mappings (
    seller_tax_code VARCHAR(20)  NOT NULL,
    item_key        VARCHAR(600) NOT NULL,
    item_name       VARCHAR(500) NOT NULL,
    item_unit       VARCHAR(50),
    product_id      UUID         NOT NULL,
    unit_id         UUID         NOT NULL,
    updated_by      UUID,
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (seller_tax_code, item_key)
);

-- Lịch sử đồng bộ từ cổng thuế (mỗi lần bấm Đồng bộ, thành công hay lỗi).
CREATE TABLE input_invoice_sync_logs (
    id            UUID PRIMARY KEY,
    connection_id UUID,
    tax_code      VARCHAR(20)  NOT NULL,
    from_date     DATE         NOT NULL,
    to_date       DATE         NOT NULL,
    status        VARCHAR(10)  NOT NULL CHECK (status IN ('SUCCESS', 'FAILED')),
    found         INT          NOT NULL DEFAULT 0,
    added         INT          NOT NULL DEFAULT 0,
    error         TEXT,
    user_id       UUID,
    user_name     VARCHAR(150),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_input_invoice_sync_logs_created ON input_invoice_sync_logs (created_at DESC);
