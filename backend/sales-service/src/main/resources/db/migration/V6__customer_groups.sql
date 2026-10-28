-- ===== Nhóm khách hàng =====
-- Giảm giá nhóm: PERCENT (% trên tổng tiền hàng) / AMOUNT (số tiền) — POS tự điền vào giảm giá hóa đơn khi chọn khách.
CREATE TABLE customer_groups (
    id              UUID PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    discount_type   VARCHAR(10)  NOT NULL DEFAULT 'PERCENT', -- PERCENT / AMOUNT
    discount_value  NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (discount_value >= 0),
    note            VARCHAR(500),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_customer_groups_name ON customer_groups (lower(name));

-- customers.group_name giữ lại làm bản sao tên nhóm (đổi tên nhóm → cập nhật theo) để API cũ vẫn chạy.
ALTER TABLE customers ADD COLUMN group_id UUID REFERENCES customer_groups (id);
CREATE INDEX idx_customers_group ON customers (group_id);

-- Chuyển nhóm gõ tay cũ (group_name) thành nhóm thật, gộp tên trùng không phân biệt hoa thường.
INSERT INTO customer_groups (id, name)
SELECT gen_random_uuid(), min(trim(group_name)) FROM customers
WHERE group_name IS NOT NULL AND trim(group_name) <> ''
GROUP BY lower(trim(group_name));

UPDATE customers c SET group_id = g.id, group_name = g.name
FROM customer_groups g
WHERE c.group_name IS NOT NULL AND lower(trim(c.group_name)) = lower(g.name);

UPDATE customers SET group_name = NULL WHERE group_id IS NULL;
