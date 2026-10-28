-- ===== Thiết lập giá: bảng giá =====
-- Phạm vi áp dụng lưu dạng mảng uuid: NULL = tất cả (chi nhánh / nhóm khách hàng / người tạo giao dịch).
-- missing_policy: hàng không có trong bảng giá khi bán — ALLOW (dùng giá chung), BLOCK (chặn), WARN (cho phép kèm cảnh báo).
-- auto_update: khi giá chung (product_units.price) đổi, giá trong bảng = giá chung ± auto_value (VNĐ hoặc %).
CREATE TABLE price_books (
    id                  UUID PRIMARY KEY,
    name                VARCHAR(150) NOT NULL,
    valid_from          TIMESTAMPTZ NOT NULL,
    valid_to            TIMESTAMPTZ NOT NULL,
    active              BOOLEAN NOT NULL DEFAULT TRUE,  -- Áp dụng / Chưa áp dụng
    branch_ids          UUID[],
    customer_group_ids  UUID[],
    seller_ids          UUID[],
    missing_policy      VARCHAR(10) NOT NULL DEFAULT 'ALLOW',
    auto_update         BOOLEAN NOT NULL DEFAULT FALSE,
    auto_op             VARCHAR(5) NOT NULL DEFAULT 'PLUS',  -- PLUS | MINUS
    auto_value          NUMERIC(18, 2) NOT NULL DEFAULT 0,
    auto_percent        BOOLEAN NOT NULL DEFAULT FALSE,
    created_by          UUID NOT NULL,
    created_by_name     VARCHAR(150) NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_price_books_validity CHECK (valid_from < valid_to),
    CONSTRAINT ck_price_books_policy CHECK (missing_policy IN ('ALLOW', 'BLOCK', 'WARN')),
    CONSTRAINT ck_price_books_auto_op CHECK (auto_op IN ('PLUS', 'MINUS')),
    CONSTRAINT ck_price_books_auto_value CHECK (auto_value >= 0)
);
CREATE UNIQUE INDEX uq_price_books_name ON price_books (lower(name));

-- Giá theo đơn vị tính (mỗi đơn vị = 1 mã hàng). Không có dòng = hàng không có trong bảng giá.
CREATE TABLE price_book_items (
    price_book_id  UUID NOT NULL REFERENCES price_books (id) ON DELETE CASCADE,
    unit_id        UUID NOT NULL REFERENCES product_units (id) ON DELETE CASCADE,
    price          NUMERIC(18, 2) NOT NULL CHECK (price >= 0),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (price_book_id, unit_id)
);
CREATE INDEX idx_price_book_items_unit ON price_book_items (unit_id);

-- Công thức tự cập nhật (dùng chung cho trigger và khi lưu bảng giá): làm tròn VNĐ, không âm.
CREATE FUNCTION price_book_formula(base NUMERIC, op VARCHAR, val NUMERIC, pct BOOLEAN) RETURNS NUMERIC
    LANGUAGE sql IMMUTABLE AS $$
    SELECT greatest(0, round(CASE
        WHEN pct THEN base * (1 + (CASE WHEN op = 'MINUS' THEN -val ELSE val END) / 100)
        ELSE base + (CASE WHEN op = 'MINUS' THEN -val ELSE val END) END, 0))
$$;

-- Giá chung đổi (mọi đường ghi: form hàng hóa, import...) → cập nhật các bảng giá bật auto_update.
CREATE FUNCTION price_books_follow_base_price() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    UPDATE price_book_items i
    SET price = price_book_formula(NEW.price, b.auto_op, b.auto_value, b.auto_percent), updated_at = now()
    FROM price_books b
    WHERE b.id = i.price_book_id AND b.auto_update AND i.unit_id = NEW.id;
    RETURN NEW;
END
$$;

CREATE TRIGGER trg_product_units_price_books
    AFTER UPDATE OF price ON product_units
    FOR EACH ROW WHEN (OLD.price IS DISTINCT FROM NEW.price)
    EXECUTE FUNCTION price_books_follow_base_price();
