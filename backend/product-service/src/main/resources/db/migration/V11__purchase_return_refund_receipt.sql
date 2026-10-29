-- Trả hàng nhập có tiền NCC hoàn lại (refund_amount > 0): chứng từ công nợ riêng kind = 'REFUND' (PT{mã THN}, tăng nợ
-- +amount) + phiếu thu Sổ quỹ cùng mã. Sổ công nợ: phiếu trả ghi −total (trước đây −(total − refund_amount)), phiếu thu +refund
-- → số dư không đổi. return_id nối chứng từ với phiếu trả để hủy theo.
ALTER TABLE supplier_debt_docs ADD COLUMN return_id UUID REFERENCES purchase_returns (id) ON DELETE CASCADE;
CREATE INDEX idx_supplier_debt_docs_return ON supplier_debt_docs (return_id);

-- Dữ liệu cũ: phiếu trả đã hoàn thành / đã hủy có tiền hoàn → chứng từ REFUND tương ứng
INSERT INTO supplier_debt_docs (id, code, supplier_id, kind, status, occurred_at, amount, branch_id, payment_method,
                                staff_id, staff_name, created_by, created_by_name, note, return_id, cash_source_id,
                                created_at, cancelled_at)
SELECT gen_random_uuid(), 'PT' || r.code, r.supplier_id, 'REFUND',
       CASE WHEN r.status = 'CANCELLED' THEN 'CANCELLED' ELSE 'ACTIVE' END,
       r.returned_at, r.refund_amount, r.branch_id, 'CASH',
       coalesce(r.returner_id, r.created_by), coalesce(r.returner_name, r.created_by_name), r.created_by, r.created_by_name,
       'NCC hoàn tiền trả hàng nhập ' || r.code, r.id, r.id, coalesce(r.completed_at, r.created_at), r.cancelled_at
FROM purchase_returns r
WHERE r.refund_amount > 0 AND r.supplier_id IS NOT NULL AND r.completed_at IS NOT NULL
  AND r.status IN ('COMPLETED', 'CANCELLED');

-- ... và phiếu thu Sổ quỹ cho phiếu trả còn hiệu lực (gửi qua outbox như lúc chạy thật; Sổ quỹ chống trùng theo nguồn)
INSERT INTO outbox_cashflows (id, payload)
SELECT gen_random_uuid(), json_build_object(
         'action', 'CREATE', 'sourceType', 'PURCHASE', 'sourceId', r.id, 'code', 'PT' || r.code, 'voucherType', 'RECEIPT',
         'fund', 'CASH', 'category', 'Thu Tiền NCC hoàn trả', 'amount', r.refund_amount,
         'occurredAt', to_char(r.returned_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'), 'branchId', r.branch_id,
         'partnerType', 'SUPPLIER', 'partnerId', r.supplier_id, 'partnerName', s.name, 'partnerPhone', s.phone,
         'userId', coalesce(r.returner_id, r.created_by), 'userName', coalesce(r.returner_name, r.created_by_name),
         'note', 'NCC hoàn tiền trả hàng nhập ' || r.code)::text
FROM purchase_returns r LEFT JOIN suppliers s ON s.id = r.supplier_id
WHERE r.refund_amount > 0 AND r.status = 'COMPLETED';
