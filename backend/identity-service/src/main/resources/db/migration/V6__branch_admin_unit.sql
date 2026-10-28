-- Chi nhánh: khu vực theo đơn vị hành chính 2 cấp (sau 01/07/2025) — tên (hiển thị/in) + mã (tỉnh 2 số, phường/xã 5 số).
ALTER TABLE branches
    ADD COLUMN province VARCHAR(100), ADD COLUMN ward VARCHAR(100),
    ADD COLUMN province_code VARCHAR(2), ADD COLUMN ward_code VARCHAR(5);
