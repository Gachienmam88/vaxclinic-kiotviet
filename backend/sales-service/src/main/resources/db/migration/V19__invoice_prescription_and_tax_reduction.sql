-- "Bán thuốc theo đơn": thông tin đơn thuốc lưu trên hóa đơn (chưa kết nối Hệ thống Đơn thuốc Quốc gia).
-- "Giảm thuế" theo Nghị quyết 204/2025/QH15 (01/07/2025 – 31/12/2026): dòng hàng có cờ giảm thuế + thuế suất 10% → 8%;
-- tax_reduction = số tiền giảm của hóa đơn (khách cần trả = tổng tiền hàng − giảm giá − giảm thuế).
ALTER TABLE invoices
    ADD COLUMN tax_reduction NUMERIC(18, 0) NOT NULL DEFAULT 0 CHECK (tax_reduction >= 0),
    ADD COLUMN prescription BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN prescription_code VARCHAR(50),
    ADD COLUMN prescription_doctor VARCHAR(150),
    ADD COLUMN prescription_facility VARCHAR(250),
    ADD COLUMN prescription_diagnosis VARCHAR(500);

ALTER TABLE invoice_lines ADD COLUMN tax_reduced BOOLEAN NOT NULL DEFAULT FALSE;
