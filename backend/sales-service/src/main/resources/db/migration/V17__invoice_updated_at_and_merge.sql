-- ===== Danh sách hóa đơn: cột "Ngày cập nhật"; gộp hóa đơn: hóa đơn gốc trỏ tới hóa đơn gộp =====

-- Ngày cập nhật = lần ghi gần nhất vào hóa đơn (sửa, thanh toán, hủy...). Trigger giữ đúng mà không cần sửa code ghi.
ALTER TABLE invoices ADD COLUMN updated_at TIMESTAMPTZ;
UPDATE invoices SET updated_at = coalesce(cancelled_at, created_at);
ALTER TABLE invoices ALTER COLUMN updated_at SET NOT NULL, ALTER COLUMN updated_at SET DEFAULT now();

CREATE OR REPLACE FUNCTION invoices_touch_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION invoices_touch_updated_at();

-- "Gộp đơn": các hóa đơn gốc chuyển Đã hủy và ghi hóa đơn mới đã gộp vào.
ALTER TABLE invoices ADD COLUMN merged_into_id UUID REFERENCES invoices (id);
CREATE INDEX idx_invoices_merged_into ON invoices (merged_into_id) WHERE merged_into_id IS NOT NULL;
