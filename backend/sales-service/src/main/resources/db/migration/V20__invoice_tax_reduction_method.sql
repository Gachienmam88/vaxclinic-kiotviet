-- Phương pháp tính "Giảm thuế" của hóa đơn: DEDUCTION (khấu trừ, 10% → 8%) / DIRECT (trực tiếp trên doanh thu, 20% tỷ lệ %
-- ngành); NULL = không giảm. Hóa đơn đã giảm trước đây đều theo khấu trừ.
ALTER TABLE invoices ADD COLUMN tax_reduction_method VARCHAR(10) CHECK (tax_reduction_method IN ('DEDUCTION', 'DIRECT'));
UPDATE invoices SET tax_reduction_method = 'DEDUCTION' WHERE tax_reduction > 0;
