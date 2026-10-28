-- ===== Kênh bán + bảng giá áp dụng + thời gian giao hàng (bật bộ lọc báo cáo) =====
-- Kênh bán: danh sách quản lý được (Thiết lập → Kênh bán). DIRECT "Bán trực tiếp" là mặc định, không xóa được.
CREATE SEQUENCE sales_channel_code_seq START 1; -- CH001 (kênh tạo thêm)

CREATE TABLE sales_channels (
    code        VARCHAR(30) PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    active      BOOLEAN NOT NULL DEFAULT TRUE,
    builtin     BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order  INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_sales_channels_name ON sales_channels (lower(name));
INSERT INTO sales_channels (code, name, builtin, sort_order) VALUES
    ('DIRECT', 'Bán trực tiếp', TRUE, 0),
    ('FACEBOOK', 'Facebook', FALSE, 1),
    ('ZALO', 'Zalo', FALSE, 2),
    ('WEBSITE', 'Website', FALSE, 3),
    ('PHONE', 'Điện thoại', FALSE, 4);

-- price_book_id: bảng giá ở product-service (không FK chéo DB) + tên lưu lại lúc bán (bảng giá bị xóa vẫn hiện tên).
ALTER TABLE invoices
    ADD COLUMN price_book_id   UUID,
    ADD COLUMN price_book_name VARCHAR(150),
    ADD COLUMN sales_channel   VARCHAR(30) NOT NULL DEFAULT 'DIRECT' REFERENCES sales_channels (code);
CREATE INDEX idx_invoices_channel ON invoices (sales_channel);

ALTER TABLE customer_orders
    ADD COLUMN price_book_id        UUID,
    ADD COLUMN price_book_name      VARCHAR(150),
    ADD COLUMN sales_channel        VARCHAR(30) NOT NULL DEFAULT 'DIRECT' REFERENCES sales_channels (code),
    ADD COLUMN expected_delivery_at TIMESTAMPTZ; -- Thời gian giao hàng
