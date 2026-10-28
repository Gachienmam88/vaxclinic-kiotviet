-- Mã đơn vị hành chính 2 cấp (sau sắp xếp 01/07/2025): tỉnh/thành 2 số, phường/xã/đặc khu 5 số. Giữ cột tên province/ward để hiển thị/in.
ALTER TABLE suppliers ADD COLUMN province_code VARCHAR(2), ADD COLUMN ward_code VARCHAR(5);
