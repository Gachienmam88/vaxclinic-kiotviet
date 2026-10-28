-- Mã tỷ lệ thuế của hàng lúc bán (KCT, VAT5, ...) — dùng khi phát hành hóa đơn điện tử.
ALTER TABLE invoice_lines ADD COLUMN tax_code VARCHAR(30);
