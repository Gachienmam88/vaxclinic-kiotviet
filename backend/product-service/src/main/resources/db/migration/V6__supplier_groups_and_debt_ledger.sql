-- ===== Nhà cung cấp: nhóm NCC + sổ công nợ NCC (thanh toán, chiết khấu thanh toán, điều chỉnh) =====

-- Nhóm NCC thành bảng riêng (trước đây chỉ là chuỗi group_name trên NCC).
CREATE TABLE supplier_groups (
    id          UUID PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    note        TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_supplier_groups_name ON supplier_groups (lower(name));

INSERT INTO supplier_groups (id, name)
SELECT gen_random_uuid(), g FROM (
    SELECT DISTINCT ON (lower(trim(group_name))) trim(group_name) g
    FROM suppliers WHERE group_name IS NOT NULL AND trim(group_name) <> ''
) x;

ALTER TABLE suppliers
    ADD COLUMN group_id        UUID REFERENCES supplier_groups (id) ON DELETE SET NULL,
    ADD COLUMN branch_id       UUID,          -- chi nhánh tạo NCC (hiển thị ở chi tiết)
    ADD COLUMN created_by      UUID,
    ADD COLUMN created_by_name VARCHAR(150);
UPDATE suppliers s SET group_id = g.id FROM supplier_groups g WHERE lower(trim(s.group_name)) = lower(g.name);
ALTER TABLE suppliers DROP COLUMN group_name;

-- Chứng từ công nợ NCC ngoài phiếu nhập / trả hàng nhập.
--   PAYMENT    = phiếu chi trả NCC (PCN000001, hoặc PC + mã phiếu nhập khi trả tiền lúc nhập hàng) → có phiếu chi Sổ quỹ
--   DISCOUNT   = chiết khấu thanh toán NCC cho mình (CKN000001) → giảm nợ, KHÔNG có phiếu Sổ quỹ
--   ADJUSTMENT = điều chỉnh công nợ (DCN000001), amount = nợ mới − nợ cũ (có dấu)
CREATE SEQUENCE supplier_payment_code_seq START 1;
CREATE SEQUENCE supplier_discount_code_seq START 1;
CREATE SEQUENCE supplier_adjust_code_seq START 1;

CREATE TABLE supplier_debt_docs (
    id               UUID PRIMARY KEY,
    code             VARCHAR(30)  NOT NULL UNIQUE,
    supplier_id      UUID         NOT NULL REFERENCES suppliers (id) ON DELETE CASCADE,
    kind             VARCHAR(20)  NOT NULL,                  -- PAYMENT | DISCOUNT | ADJUSTMENT
    status           VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE', -- ACTIVE | CANCELLED
    occurred_at      TIMESTAMPTZ  NOT NULL,
    amount           NUMERIC(18, 0) NOT NULL,                -- PAYMENT/DISCOUNT > 0 (giảm nợ); ADJUSTMENT có dấu
    branch_id        UUID,
    payment_method   VARCHAR(20),                            -- CASH | TRANSFER | EWALLET
    bank_account_id  UUID,                                   -- tài khoản ngân hàng / ví (sales-service)
    staff_id         UUID,                                   -- người chi / người thực hiện
    staff_name       VARCHAR(150),
    created_by       UUID         NOT NULL,
    created_by_name  VARCHAR(150) NOT NULL,
    note             TEXT,
    receipt_id       UUID REFERENCES purchase_receipts (id) ON DELETE CASCADE, -- phiếu chi trả lúc nhập hàng
    cash_source_id   UUID,                                   -- sourceId phiếu chi bên Sổ quỹ (sourceType PURCHASE)
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    cancelled_at     TIMESTAMPTZ
);
CREATE INDEX idx_supplier_debt_docs_supplier ON supplier_debt_docs (supplier_id, occurred_at);
CREATE INDEX idx_supplier_debt_docs_receipt ON supplier_debt_docs (receipt_id);

-- Phân bổ thanh toán / chiết khấu vào phiếu nhập. purchase_receipts.paid_amount = Σ phân bổ PAYMENT còn hiệu lực.
CREATE TABLE supplier_debt_allocations (
    doc_id      UUID NOT NULL REFERENCES supplier_debt_docs (id) ON DELETE CASCADE,
    receipt_id  UUID NOT NULL REFERENCES purchase_receipts (id) ON DELETE CASCADE,
    amount      NUMERIC(18, 0) NOT NULL CHECK (amount > 0),
    PRIMARY KEY (doc_id, receipt_id)
);
CREATE INDEX idx_supplier_debt_allocations_receipt ON supplier_debt_allocations (receipt_id);

-- Đối soát dữ liệu cũ: mỗi phiếu nhập đã hoàn thành có trả tiền NCC → 1 phiếu chi PC{mã PN} phân bổ đúng phiếu đó
-- (khớp phiếu chi PURCHASE đã gửi sang Sổ quỹ, sourceId = id phiếu nhập). Phiếu nhập đã hủy → phiếu chi đã hủy.
INSERT INTO supplier_debt_docs (id, code, supplier_id, kind, status, occurred_at, amount, branch_id, payment_method,
                                staff_id, staff_name, created_by, created_by_name, note, receipt_id, cash_source_id,
                                created_at, cancelled_at)
SELECT gen_random_uuid(), 'PC' || r.code, r.supplier_id, 'PAYMENT',
       CASE WHEN r.status = 'CANCELLED' THEN 'CANCELLED' ELSE 'ACTIVE' END,
       r.received_at, r.paid_amount, r.branch_id, coalesce(r.payment_method, 'CASH'),
       coalesce(r.receiver_id, r.created_by), coalesce(r.receiver_name, r.created_by_name), r.created_by, r.created_by_name,
       'Thanh toán phiếu nhập ' || r.code, r.id, r.id, coalesce(r.completed_at, r.created_at), r.cancelled_at
FROM purchase_receipts r
WHERE r.paid_amount > 0 AND r.supplier_id IS NOT NULL AND r.completed_at IS NOT NULL
  AND r.status IN ('COMPLETED', 'CANCELLED');

INSERT INTO supplier_debt_allocations (doc_id, receipt_id, amount)
SELECT d.id, d.receipt_id, d.amount FROM supplier_debt_docs d WHERE d.receipt_id IS NOT NULL;
