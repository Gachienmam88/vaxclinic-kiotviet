-- Thiết lập → Sổ quỹ: tab Tài khoản ngân hàng / Ví điện tử dùng chung bảng; kind phân biệt.
ALTER TABLE bank_accounts ADD COLUMN kind VARCHAR(10) NOT NULL DEFAULT 'BANK'; -- BANK / EWALLET
ALTER TABLE bank_accounts ADD COLUMN note VARCHAR(300);
