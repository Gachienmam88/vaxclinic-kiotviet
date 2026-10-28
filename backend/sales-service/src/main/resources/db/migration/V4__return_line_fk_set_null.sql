-- Sửa hóa đơn thay toàn bộ dòng hàng. Phiếu trả CÒN HIỆU LỰC đã chặn việc sửa, nên chỉ dòng của phiếu trả ĐÃ HỦY
-- có thể còn trỏ tới dòng cũ → cho phép mất liên kết (SET NULL) thay vì chặn xóa (phiếu trả vẫn giữ tên/mã/SL đã chụp).
ALTER TABLE sales_return_lines ALTER COLUMN invoice_line_id DROP NOT NULL;
ALTER TABLE sales_return_lines DROP CONSTRAINT sales_return_lines_invoice_line_id_fkey;
ALTER TABLE sales_return_lines ADD CONSTRAINT sales_return_lines_invoice_line_id_fkey
    FOREIGN KEY (invoice_line_id) REFERENCES invoice_lines (id) ON DELETE SET NULL;
