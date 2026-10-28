-- Màn bán hàng (POS) dựng lại:
-- 1) "Thông tin xuất HĐĐT" nhập riêng trên hóa đơn (người mua / công ty / MST ...) — null = lấy theo khách hàng.
ALTER TABLE invoices
    ADD COLUMN einvoice_buyer_name   VARCHAR(200),
    ADD COLUMN einvoice_company_name VARCHAR(250),
    ADD COLUMN einvoice_tax_code     VARCHAR(20),
    ADD COLUMN einvoice_address      VARCHAR(500),
    ADD COLUMN einvoice_email        VARCHAR(150),
    ADD COLUMN einvoice_phone        VARCHAR(20);

-- 2) "Trả nhanh": phiếu trả hàng KHÔNG theo hóa đơn → invoice_id null.
ALTER TABLE sales_returns ALTER COLUMN invoice_id DROP NOT NULL;

-- Giá vốn / 1 đơn vị trả (đơn vị trên dòng) lúc nhập lại kho — báo cáo giá vốn hàng trả khi không có dòng hóa đơn gốc.
ALTER TABLE sales_return_lines ADD COLUMN cost NUMERIC(18, 4);
