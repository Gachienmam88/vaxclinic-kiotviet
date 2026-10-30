-- Sổ nợ khách theo chi nhánh: báo cáo (VD Chiết khấu thanh toán của Báo cáo tài chính) lọc được theo chi nhánh người xem.
-- Dữ liệu cũ: chi nhánh của chứng từ gốc theo doc_id (hóa đơn, phiếu trả, phiếu thu/chi, đơn đặt hàng, vận đơn thu hộ);
-- chiết khấu / điều chỉnh không có chứng từ → chi nhánh tạo khách; vẫn không có → chi nhánh mặc định CN001.
ALTER TABLE customer_debt_ledger ADD COLUMN branch_id UUID;

UPDATE customer_debt_ledger d SET branch_id = coalesce(
    (SELECT i.branch_id FROM invoices i WHERE i.id = d.doc_id),
    (SELECT r.branch_id FROM sales_returns r WHERE r.id = d.doc_id),
    (SELECT v.branch_id FROM cash_vouchers v WHERE v.id = d.doc_id),
    (SELECT o.branch_id FROM customer_orders o WHERE o.id = d.doc_id),
    (SELECT s.branch_id FROM shipments s WHERE s.id = d.doc_id),
    (SELECT c.branch_id FROM customers c WHERE c.id = d.customer_id),
    '00000000-0000-0000-0000-000000000001'::uuid);

ALTER TABLE customer_debt_ledger ALTER COLUMN branch_id SET NOT NULL;
CREATE INDEX idx_debt_ledger_branch_time ON customer_debt_ledger (branch_id, occurred_at);
