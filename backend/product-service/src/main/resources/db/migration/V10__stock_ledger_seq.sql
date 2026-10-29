-- Thứ tự ghi thẻ kho: occurred_at giờ là ngày CHỨNG TỪ (có thể lùi ngày), nên cần khóa phụ ổn định cho các dòng cùng thời điểm
-- để tính lại balance_after (tồn sau giao dịch) khi chèn dòng lùi ngày. Dòng cũ được đánh số theo thứ tự đọc bảng.
ALTER TABLE stock_ledger ADD COLUMN seq BIGSERIAL;
CREATE INDEX idx_stock_ledger_product_branch_time ON stock_ledger (product_id, branch_id, occurred_at, seq);
CREATE INDEX idx_stock_ledger_doc ON stock_ledger (doc_id);
