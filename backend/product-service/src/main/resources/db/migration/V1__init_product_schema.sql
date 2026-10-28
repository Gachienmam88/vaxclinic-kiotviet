-- ===== Danh mục =====
-- Nhóm hàng (cây nhiều cấp qua parent_id).
CREATE TABLE categories (
    id          UUID PRIMARY KEY,
    name        VARCHAR(150) NOT NULL,
    parent_id   UUID REFERENCES categories (id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tỷ lệ tính thuế (VAT bán ra). vat_rate NULL = không chịu thuế / không kê khai.
CREATE TABLE tax_rates (
    id         UUID PRIMARY KEY,
    code       VARCHAR(30)  NOT NULL UNIQUE,
    name       VARCHAR(250) NOT NULL,
    vat_rate   NUMERIC(5, 2),
    sort_order INT NOT NULL
);

-- Vị trí trưng bày / trong kho (tủ, kệ).
CREATE TABLE positions (
    id    UUID PRIMARY KEY,
    name  VARCHAR(100) NOT NULL UNIQUE
);

-- ===== Hàng hóa =====
-- products = "hàng hóa gốc". Mỗi hàng có 1..n đơn vị tính (product_units); mỗi đơn vị có mã hàng riêng
-- (VD SP000100 = Hộp, SP000101 = Liều) => tab "Hàng hóa cùng loại".
-- Tồn kho và giá vốn luôn tính theo ĐƠN VỊ CƠ BẢN (conversion_rate = 1).
CREATE TABLE products (
    id                 UUID PRIMARY KEY,
    name               VARCHAR(250) NOT NULL,
    short_name         VARCHAR(100),
    einvoice_name      VARCHAR(250),
    category_id        UUID NOT NULL REFERENCES categories (id),
    tax_rate_id        UUID REFERENCES tax_rates (id),
    tax_reduction      BOOLEAN NOT NULL DEFAULT FALSE,  -- áp dụng giảm thuế GTGT theo chính sách
    lot_managed        BOOLEAN NOT NULL DEFAULT FALSE,  -- quản lý theo lô, hạn sử dụng
    cost               NUMERIC(18, 4) NOT NULL DEFAULT 0, -- giá vốn bình quân / đơn vị cơ bản
    min_stock          NUMERIC(18, 3) NOT NULL DEFAULT 0,
    max_stock          NUMERIC(18, 3) NOT NULL DEFAULT 999999999,
    position_id        UUID REFERENCES positions (id),
    weight             NUMERIC(12, 3),
    weight_unit        VARCHAR(5) NOT NULL DEFAULT 'g',
    description        TEXT,
    note               TEXT,
    loyalty_points     BOOLEAN NOT NULL DEFAULT TRUE,   -- được tích điểm
    active             BOOLEAN NOT NULL DEFAULT TRUE,   -- đang kinh doanh
    deleted            BOOLEAN NOT NULL DEFAULT FALSE,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_products_category ON products (category_id);

CREATE SEQUENCE product_code_seq START 1;

CREATE TABLE product_units (
    id               UUID PRIMARY KEY,
    product_id       UUID NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    code             VARCHAR(50) NOT NULL UNIQUE,
    barcode          VARCHAR(100),
    unit_name        VARCHAR(50) NOT NULL,
    conversion_rate  NUMERIC(18, 4) NOT NULL,      -- số đơn vị cơ bản trong 1 đơn vị này
    price            NUMERIC(18, 2) NOT NULL DEFAULT 0,
    is_base          BOOLEAN NOT NULL,
    direct_sale      BOOLEAN NOT NULL DEFAULT TRUE, -- hiện trên màn bán hàng
    sort_order       INT NOT NULL DEFAULT 0
);
CREATE INDEX idx_product_units_product ON product_units (product_id);
CREATE INDEX idx_product_units_barcode ON product_units (barcode);
CREATE UNIQUE INDEX uq_product_units_base ON product_units (product_id) WHERE is_base;

-- ===== Kho =====
-- Tồn theo hàng × điểm tiêm (branch_id lấy từ identity-service).
CREATE TABLE stock_balances (
    product_id  UUID NOT NULL REFERENCES products (id),
    branch_id   UUID NOT NULL,
    quantity    NUMERIC(18, 3) NOT NULL DEFAULT 0,
    reserved    NUMERIC(18, 3) NOT NULL DEFAULT 0,  -- khách đặt
    PRIMARY KEY (product_id, branch_id)
);

-- Tồn theo lô (chỉ dùng cho hàng lot_managed). Tổng các lô = stock_balances.quantity.
CREATE TABLE product_lots (
    id           UUID PRIMARY KEY,
    product_id   UUID NOT NULL REFERENCES products (id),
    branch_id    UUID NOT NULL,
    lot_number   VARCHAR(50) NOT NULL,
    expiry_date  DATE NOT NULL,
    quantity     NUMERIC(18, 3) NOT NULL DEFAULT 0,
    UNIQUE (product_id, branch_id, lot_number)
);
CREATE INDEX idx_product_lots_expiry ON product_lots (expiry_date);

-- Thẻ kho: mỗi biến động tồn = 1 dòng bất biến.
CREATE TABLE stock_ledger (
    id             UUID PRIMARY KEY,
    product_id     UUID NOT NULL REFERENCES products (id),
    branch_id      UUID NOT NULL,
    lot_number     VARCHAR(50),
    doc_type       VARCHAR(30) NOT NULL,  -- OPENING, PURCHASE, SALE, RETURN, ADJUSTMENT...
    doc_id         UUID,
    doc_code       VARCHAR(50),
    occurred_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    quantity       NUMERIC(18, 3) NOT NULL,  -- +nhập / -xuất (đơn vị cơ bản)
    unit_price     NUMERIC(18, 4) NOT NULL DEFAULT 0, -- giá giao dịch
    cost           NUMERIC(18, 4) NOT NULL DEFAULT 0, -- giá vốn sau giao dịch
    balance_after  NUMERIC(18, 3) NOT NULL,
    partner_name   VARCHAR(250),
    created_by     UUID
);
CREATE INDEX idx_stock_ledger_product ON stock_ledger (product_id, occurred_at DESC);

-- ===== Seed =====
INSERT INTO categories (id, name) VALUES ('00000000-0000-0000-0002-000000000001', 'Vắc xin');

INSERT INTO tax_rates (id, code, name, vat_rate, sort_order) VALUES
    ('00000000-0000-0000-0003-000000000001', 'KCT', 'KCT (không chịu thuế GTGT)', NULL, 1),
    ('00000000-0000-0000-0003-000000000002', 'KKKNT', 'KKKNT (không kê khai, tính nộp thuế)', NULL, 2),
    ('00000000-0000-0000-0003-000000000003', 'VAT0', '0%', 0, 3),
    ('00000000-0000-0000-0003-000000000004', 'VAT5', '5%', 5, 4),
    ('00000000-0000-0000-0003-000000000005', 'VAT8', '8%', 8, 5),
    ('00000000-0000-0000-0003-000000000006', 'VAT10', '10%', 10, 6),
    ('00000000-0000-0000-0003-000000000007', 'HKD_KCT_15', 'KCT GTGT, 1,5% TNCN (sản xuất, vận tải, dịch vụ có gắn với hàng hóa)', NULL, 7);
