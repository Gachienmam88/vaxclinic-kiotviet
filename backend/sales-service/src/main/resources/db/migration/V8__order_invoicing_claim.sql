-- Giữ chỗ đơn đặt hàng khi đang lập hóa đơn: 2 máy cùng "Tạo hóa đơn" từ 1 đơn → máy sau bị chặn TRƯỚC khi xuất kho.
-- Giữ chỗ quá 2 phút (request treo / máy chết giữa chừng) được coi là hết hạn.
ALTER TABLE customer_orders ADD COLUMN invoicing_id UUID, ADD COLUMN invoicing_at TIMESTAMPTZ;
