-- ===== Hóa đơn đầu vào =====
-- Kết nối cổng hóa đơn điện tử của cơ quan thuế (có thể nhiều MST). Mật khẩu mã hóa AES-GCM.
CREATE TABLE tax_connections (
    id               UUID PRIMARY KEY,
    tax_code         VARCHAR(20)  NOT NULL UNIQUE,
    username         VARCHAR(50)  NOT NULL,
    password_enc     TEXT         NOT NULL,
    active           BOOLEAN      NOT NULL DEFAULT TRUE,
    last_synced_at   TIMESTAMPTZ,
    last_error       TEXT,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Hóa đơn mua vào (đồng bộ từ cổng thuế hoặc nhập file XML). 1 hóa đơn = (MST bán, mẫu số, ký hiệu, số).
CREATE TABLE input_invoices (
    id                 UUID PRIMARY KEY,
    buyer_tax_code     VARCHAR(20)  NOT NULL,
    seller_tax_code    VARCHAR(20)  NOT NULL,
    seller_name        VARCHAR(400),
    seller_address     VARCHAR(500),
    template_no        VARCHAR(10),         -- mẫu số (khmshdon), VD 1
    series             VARCHAR(20)  NOT NULL, -- ký hiệu (khhdon), VD C26TAA
    number             VARCHAR(20)  NOT NULL, -- số hóa đơn (shdon)
    issued_at          DATE         NOT NULL,
    total_before_tax   NUMERIC(18, 0),
    vat_amount         NUMERIC(18, 0),
    total              NUMERIC(18, 0) NOT NULL,
    nature             VARCHAR(30)  NOT NULL DEFAULT 'ORIGINAL', -- ORIGINAL / REPLACE / ADJUST
    source             VARCHAR(10)  NOT NULL,  -- PORTAL / XML
    lines              TEXT,                   -- JSON danh sách hàng hóa (tên, ĐVT, SL, đơn giá, thuế suất, thành tiền)
    receipt_id         UUID,                   -- phiếu nhập đã lập từ hóa đơn này
    receipt_code       VARCHAR(30),
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (seller_tax_code, template_no, series, number)
);
CREATE INDEX idx_input_invoices_issued ON input_invoices (issued_at DESC);

-- ===== Hóa đơn điện tử bán ra (MISA meInvoice — hóa đơn khởi tạo từ máy tính tiền) =====
CREATE TABLE einvoice_settings (
    id             INT PRIMARY KEY CHECK (id = 1),  -- 1 cấu hình cho cả doanh nghiệp
    provider       VARCHAR(20)  NOT NULL DEFAULT 'MISA',
    environment    VARCHAR(10)  NOT NULL DEFAULT 'TEST', -- TEST / PROD
    app_id         VARCHAR(100),
    tax_code       VARCHAR(20),
    username       VARCHAR(100),
    password_enc   TEXT,
    inv_series     VARCHAR(20),        -- ký hiệu, VD 2C26MAA
    invoice_name   VARCHAR(100) NOT NULL DEFAULT 'Hóa đơn bán hàng',
    send_email     BOOLEAN      NOT NULL DEFAULT FALSE,
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Kết quả phát hành theo từng hóa đơn bán (sales-service invoices.id).
CREATE TABLE einvoice_records (
    invoice_id      UUID PRIMARY KEY,
    invoice_code    VARCHAR(30)  NOT NULL,
    status          VARCHAR(20)  NOT NULL,  -- PUBLISHED / FAILED
    ref_id          UUID         NOT NULL,  -- RefID gửi MISA (giữ nguyên khi thử lại → MISA chống trùng)
    transaction_id  VARCHAR(100),           -- mã tra cứu
    inv_series      VARCHAR(20),
    inv_no          VARCHAR(20),
    inv_code        VARCHAR(100),           -- mã của cơ quan thuế
    inv_date        VARCHAR(30),
    error           TEXT,
    attempts        INT          NOT NULL DEFAULT 0,
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);
