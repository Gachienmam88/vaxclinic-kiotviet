-- Công thức giá của bảng giá: gốc tính (giá chung / giá vốn / giá nhập cuối / 1 bảng giá khác) ± auto_value.
-- NULL = không có công thức (dữ liệu cũ có auto_update = theo giá chung). auto_update (trigger theo giá chung)
-- chỉ bật khi gốc là giá chung.
ALTER TABLE price_books
    ADD COLUMN auto_base         VARCHAR(20),
    ADD COLUMN auto_base_book_id UUID REFERENCES price_books (id) ON DELETE SET NULL,
    ADD CONSTRAINT ck_price_books_auto_base CHECK (auto_base IN ('BASE_PRICE', 'COST', 'LAST_PURCHASE', 'BOOK'));
