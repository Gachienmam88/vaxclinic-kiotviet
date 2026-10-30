-- VAT theo từng dòng phiếu nhập / trả hàng nhập (KiotViet: cột "VAT (%)" trên dòng) + ghi chú dòng.
-- vat_mode: LINE = VAT phiếu = Σ VAT từng dòng; MANUAL = VAT phiếu nhập tay (dòng không mang VAT%).
-- Phiếu cũ: mọi dòng nhận mức VAT chung của phiếu → số liệu không đổi.
ALTER TABLE purchase_receipt_lines
    ADD COLUMN vat_rate NUMERIC(5, 2),
    ADD COLUMN note     VARCHAR(500);
UPDATE purchase_receipt_lines l SET vat_rate = r.vat_rate FROM purchase_receipts r WHERE r.id = l.receipt_id;

ALTER TABLE purchase_receipts
    ADD COLUMN vat_mode       VARCHAR(10) NOT NULL DEFAULT 'LINE' CHECK (vat_mode IN ('LINE', 'MANUAL')),
    -- Phiếu chi trả NCC (PC{mã PN}) đã được lập: lúc Hoàn thành, hoặc lúc Lưu tạm khi người dùng chọn lưu phiếu chi ngay.
    ADD COLUMN payment_posted BOOLEAN     NOT NULL DEFAULT FALSE;
UPDATE purchase_receipts SET payment_posted = TRUE WHERE status = 'COMPLETED';

ALTER TABLE purchase_return_lines
    ADD COLUMN vat_rate NUMERIC(5, 2),
    ADD COLUMN note     VARCHAR(500);
UPDATE purchase_return_lines l SET vat_rate = r.vat_rate FROM purchase_returns r WHERE r.id = l.return_id;

ALTER TABLE purchase_returns
    ADD COLUMN vat_mode       VARCHAR(10) NOT NULL DEFAULT 'LINE' CHECK (vat_mode IN ('LINE', 'MANUAL')),
    -- Hình thức NCC hoàn tiền (phiếu thu PT{mã THN}): CASH / TRANSFER.
    ADD COLUMN payment_method VARCHAR(20);
