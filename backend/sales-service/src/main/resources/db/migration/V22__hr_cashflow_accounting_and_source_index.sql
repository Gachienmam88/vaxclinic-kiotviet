-- Phiếu chi lương (PAYROLL, PCPL…) và tạm ứng lương (HR_ADVANCE, PCTU…) nhận từ identity-service là chi phí kinh doanh:
-- hạch toán (accounting = true) để vào "Chi phí lương" của Báo cáo tài chính / sổ chi phí.
UPDATE cash_vouchers SET accounting = TRUE WHERE source_type IN ('PAYROLL', 'HR_ADVANCE') AND NOT accounting;

-- Chống trùng phiếu tự động theo nguồn (outbox gửi lặp / song song) mở rộng cho 2 nguồn nhân sự.
DROP INDEX IF EXISTS uq_cash_vouchers_source;
CREATE UNIQUE INDEX uq_cash_vouchers_source ON cash_vouchers (source_type, source_id)
    WHERE source_type IN ('INVOICE', 'PURCHASE', 'PAYROLL', 'HR_ADVANCE');
