CREATE SEQUENCE customer_code_seq START 1;   -- KH000001
CREATE SEQUENCE invoice_code_seq START 1;    -- HD000001
CREATE SEQUENCE receipt_voucher_seq START 1; -- PT000001 (phiếu thu tay / thu nợ)
CREATE SEQUENCE payment_voucher_seq START 1; -- PC000001 (phiếu chi tay)
CREATE SEQUENCE debt_adjust_seq START 1;     -- DC000001 (điều chỉnh công nợ)
CREATE SEQUENCE debt_discount_seq START 1;   -- CKTT000001 (chiết khấu thanh toán)

-- ===== Khách hàng (người tiêm / người mua) =====
CREATE TABLE customers (
    id               UUID PRIMARY KEY,
    code             VARCHAR(30)  NOT NULL UNIQUE,
    name             VARCHAR(200) NOT NULL,
    phone            VARCHAR(20),
    phone2           VARCHAR(20),
    email            VARCHAR(150),
    facebook         VARCHAR(200),
    birthday         DATE,
    gender           VARCHAR(10),          -- MALE / FEMALE
    address          VARCHAR(500),
    province         VARCHAR(100),
    ward             VARCHAR(100),
    group_name       VARCHAR(100),
    note             TEXT,
    -- Thông tin xuất hóa đơn
    customer_type    VARCHAR(20) NOT NULL DEFAULT 'PERSONAL', -- PERSONAL (cá nhân/hộ KD) / COMPANY
    buyer_name       VARCHAR(200),
    company_name     VARCHAR(250),
    tax_code         VARCHAR(20),
    invoice_address  VARCHAR(500),
    invoice_province VARCHAR(100),
    invoice_ward     VARCHAR(100),
    id_number        VARCHAR(20),
    passport         VARCHAR(20),
    invoice_email    VARCHAR(150),
    invoice_phone    VARCHAR(20),
    bank_name        VARCHAR(150),
    bank_account     VARCHAR(50),
    -- Số liệu tổng hợp (nguồn gốc: hóa đơn + sổ công nợ)
    debt             NUMERIC(18, 0) NOT NULL DEFAULT 0,
    total_sales      NUMERIC(18, 0) NOT NULL DEFAULT 0,
    total_returns    NUMERIC(18, 0) NOT NULL DEFAULT 0,
    branch_id        UUID,
    created_by       UUID,
    created_by_name  VARCHAR(150),
    active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_customers_phone ON customers (phone);
CREATE INDEX idx_customers_name ON customers (lower(name));

-- ===== Hóa đơn =====
-- id do máy bán hàng sinh (UUID) => đồng bộ offline gửi lại nhiều lần vẫn chỉ tạo 1 hóa đơn.
CREATE TABLE invoices (
    id               UUID PRIMARY KEY,
    code             VARCHAR(30) NOT NULL UNIQUE,
    branch_id        UUID NOT NULL,
    customer_id      UUID REFERENCES customers (id),
    customer_name    VARCHAR(200),
    seller_id        UUID,
    seller_name      VARCHAR(150),
    created_by       UUID NOT NULL,
    created_by_name  VARCHAR(150) NOT NULL,
    sold_at          TIMESTAMPTZ NOT NULL,
    status           VARCHAR(20) NOT NULL,            -- COMPLETED / CANCELLED
    sale_mode        VARCHAR(20) NOT NULL DEFAULT 'QUICK', -- QUICK / NORMAL / DELIVERY
    subtotal         NUMERIC(18, 0) NOT NULL,         -- tổng tiền hàng
    discount         NUMERIC(18, 0) NOT NULL DEFAULT 0, -- giảm giá hóa đơn
    total            NUMERIC(18, 0) NOT NULL,         -- khách cần trả
    paid             NUMERIC(18, 0) NOT NULL DEFAULT 0, -- khách đã trả (tổng phân bổ từ phiếu thu)
    payment_method   VARCHAR(20),
    note             TEXT,
    offline          BOOLEAN NOT NULL DEFAULT FALSE,  -- tạo khi mất mạng, đồng bộ sau
    cancelled_at     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_invoices_sold_at ON invoices (sold_at DESC);
CREATE INDEX idx_invoices_customer ON invoices (customer_id);

CREATE TABLE invoice_lines (
    id               UUID PRIMARY KEY,
    invoice_id       UUID NOT NULL REFERENCES invoices (id) ON DELETE CASCADE,
    line_no          INT NOT NULL,
    product_id       UUID NOT NULL,
    unit_id          UUID NOT NULL,
    product_code     VARCHAR(50)  NOT NULL,
    product_name     VARCHAR(250) NOT NULL,
    unit_name        VARCHAR(50)  NOT NULL,
    quantity         NUMERIC(18, 3) NOT NULL,
    unit_price       NUMERIC(18, 2) NOT NULL,  -- đơn giá
    discount         NUMERIC(18, 2) NOT NULL DEFAULT 0, -- giảm giá / 1 đơn vị
    cost             NUMERIC(18, 4) NOT NULL DEFAULT 0, -- giá vốn / 1 đơn vị lúc bán (từ product-service)
    lots             TEXT,                     -- lô đã xuất (FEFO), VD "A21CD:1"
    note             VARCHAR(500)
);
CREATE INDEX idx_invoice_lines_invoice ON invoice_lines (invoice_id);

-- ===== Sổ quỹ =====
CREATE TABLE bank_accounts (
    id            UUID PRIMARY KEY,
    bank_name     VARCHAR(150) NOT NULL,
    bank_bin      VARCHAR(10),          -- mã BIN ngân hàng (VietQR)
    account_no    VARCHAR(50)  NOT NULL,
    account_name  VARCHAR(200) NOT NULL,
    active        BOOLEAN NOT NULL DEFAULT TRUE
);

-- Phiếu thu (RECEIPT) / phiếu chi (PAYMENT). amount luôn dương.
CREATE TABLE cash_vouchers (
    id                UUID PRIMARY KEY,
    code              VARCHAR(40) NOT NULL UNIQUE,
    voucher_type      VARCHAR(10) NOT NULL,      -- RECEIPT / PAYMENT
    fund              VARCHAR(10) NOT NULL,      -- CASH / BANK / EWALLET
    bank_account_id   UUID REFERENCES bank_accounts (id),
    category          VARCHAR(100) NOT NULL,     -- loại thu chi
    amount            NUMERIC(18, 0) NOT NULL CHECK (amount > 0),
    occurred_at       TIMESTAMPTZ NOT NULL,
    branch_id         UUID NOT NULL,
    partner_type      VARCHAR(20) NOT NULL,      -- CUSTOMER / SUPPLIER / EMPLOYEE / OTHER
    partner_id        UUID,
    partner_name      VARCHAR(250),
    partner_phone     VARCHAR(20),
    collector_id      UUID,                      -- người thu / người chi
    collector_name    VARCHAR(150),
    created_by        UUID,
    created_by_name   VARCHAR(150),
    accounting        BOOLEAN NOT NULL DEFAULT TRUE, -- hạch toán vào kết quả kinh doanh
    affects_debt      BOOLEAN NOT NULL DEFAULT FALSE,
    status            VARCHAR(20) NOT NULL DEFAULT 'PAID', -- PAID / CANCELLED
    source_type       VARCHAR(20) NOT NULL DEFAULT 'MANUAL', -- MANUAL / INVOICE / DEBT / PURCHASE
    source_id         UUID,
    note              TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cash_vouchers_time ON cash_vouchers (occurred_at DESC);
-- 1 nguồn (hóa đơn / phiếu nhập) chỉ sinh 1 phiếu tự động => nhận lặp từ outbox không tạo trùng
CREATE UNIQUE INDEX uq_cash_vouchers_source ON cash_vouchers (source_type, source_id)
    WHERE source_type IN ('INVOICE', 'PURCHASE');

-- Phân bổ phiếu thu vào hóa đơn (tab "Lịch sử thanh toán", "Phân bổ vào hóa đơn")
CREATE TABLE voucher_allocations (
    voucher_id  UUID NOT NULL REFERENCES cash_vouchers (id),
    invoice_id  UUID NOT NULL REFERENCES invoices (id),
    amount      NUMERIC(18, 0) NOT NULL,
    PRIMARY KEY (voucher_id, invoice_id)
);

-- Sổ công nợ khách hàng. amount > 0 làm tăng nợ (bán hàng), < 0 làm giảm (thanh toán, chiết khấu).
CREATE TABLE customer_debt_ledger (
    id             UUID PRIMARY KEY,
    customer_id    UUID NOT NULL REFERENCES customers (id),
    doc_type       VARCHAR(20) NOT NULL,  -- SALE, SALE_CANCEL, PAYMENT, PAYMENT_CANCEL, ADJUST, DISCOUNT
    doc_id         UUID,
    doc_code       VARCHAR(40) NOT NULL,
    amount         NUMERIC(18, 0) NOT NULL,
    balance_after  NUMERIC(18, 0) NOT NULL,
    note           TEXT,
    occurred_at    TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_debt_ledger_customer ON customer_debt_ledger (customer_id, occurred_at DESC);
