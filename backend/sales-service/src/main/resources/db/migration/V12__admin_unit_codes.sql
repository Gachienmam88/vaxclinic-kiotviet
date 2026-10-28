-- Mã đơn vị hành chính 2 cấp (sau sắp xếp 01/07/2025): tỉnh/thành 2 số, phường/xã/đặc khu 5 số. Cột tên cũ giữ để hiển thị/in.
ALTER TABLE customers
    ADD COLUMN province_code VARCHAR(2), ADD COLUMN ward_code VARCHAR(5),
    ADD COLUMN invoice_province_code VARCHAR(2), ADD COLUMN invoice_ward_code VARCHAR(5);

-- Vận đơn: area = "Phường/Xã, Tỉnh/Thành phố" (tên, như cũ) + mã để lọc theo tỉnh.
ALTER TABLE shipments ADD COLUMN province_code VARCHAR(2), ADD COLUMN ward_code VARCHAR(5);
CREATE INDEX idx_shipments_province_code ON shipments (province_code);

-- Đối tác giao hàng: trước chỉ có địa chỉ tự do.
ALTER TABLE delivery_partners
    ADD COLUMN province VARCHAR(100), ADD COLUMN ward VARCHAR(100),
    ADD COLUMN province_code VARCHAR(2), ADD COLUMN ward_code VARCHAR(5);
