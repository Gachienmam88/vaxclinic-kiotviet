-- ===== Kho hàng: kiểm kho, xuất hủy, xuất dùng nội bộ =====

CREATE SEQUENCE stock_take_code_seq START 1;     -- KK000001
CREATE SEQUENCE stock_damage_code_seq START 1;   -- XH000001
CREATE SEQUENCE stock_internal_code_seq START 1; -- XNB000001

-- Phiếu kiểm kho. DRAFT = phiếu tạm, BALANCED = đã cân bằng kho (ghi thẻ kho ADJUSTMENT), CANCELLED = đã hủy (chỉ phiếu tạm).
-- Các cột tổng tính lại mỗi lần lưu / cân bằng để danh sách không phải cộng dòng.
CREATE TABLE stock_takes (
    id                  UUID PRIMARY KEY,
    code                VARCHAR(30) NOT NULL UNIQUE,
    branch_id           UUID NOT NULL,
    status              VARCHAR(20) NOT NULL,
    taken_at            TIMESTAMPTZ NOT NULL,
    balanced_at         TIMESTAMPTZ,
    cancelled_at        TIMESTAMPTZ,
    created_by          UUID NOT NULL,
    created_by_name     VARCHAR(150) NOT NULL,
    note                TEXT,
    actual_qty          NUMERIC(18, 3) NOT NULL DEFAULT 0, -- SL thực tế (dòng đã kiểm)
    actual_value        NUMERIC(18, 0) NOT NULL DEFAULT 0, -- Tổng thực tế (theo giá vốn)
    diff_value          NUMERIC(18, 0) NOT NULL DEFAULT 0, -- Tổng chênh lệch
    increase_qty        NUMERIC(18, 3) NOT NULL DEFAULT 0, -- SL lệch tăng
    decrease_qty        NUMERIC(18, 3) NOT NULL DEFAULT 0, -- SL lệch giảm (số dương)
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_stock_takes_taken ON stock_takes (taken_at DESC);

-- 1 dòng = 1 hàng (hàng không theo lô) hoặc 1 lô của hàng theo lô. Đơn vị cơ bản.
-- actual_qty NULL = chưa kiểm → cân bằng kho bỏ qua dòng này.
CREATE TABLE stock_take_lines (
    id           UUID PRIMARY KEY,
    take_id      UUID NOT NULL REFERENCES stock_takes (id) ON DELETE CASCADE,
    line_no      INT NOT NULL,
    product_id   UUID NOT NULL REFERENCES products (id),
    lot_number   VARCHAR(50),
    expiry_date  DATE,
    system_qty   NUMERIC(18, 3) NOT NULL DEFAULT 0, -- tồn kho lúc lưu / lúc cân bằng
    actual_qty   NUMERIC(18, 3),
    cost         NUMERIC(18, 4) NOT NULL DEFAULT 0  -- giá vốn / đơn vị cơ bản
);
CREATE INDEX idx_stock_take_lines_take ON stock_take_lines (take_id);

-- Xuất hủy (DAMAGE) và xuất dùng nội bộ (INTERNAL): trừ kho theo giá vốn. DRAFT / COMPLETED / CANCELLED.
CREATE TABLE stock_issues (
    id               UUID PRIMARY KEY,
    code             VARCHAR(30) NOT NULL UNIQUE,
    type             VARCHAR(20) NOT NULL,
    branch_id        UUID NOT NULL,
    status           VARCHAR(20) NOT NULL,
    issued_at        TIMESTAMPTZ NOT NULL,
    created_by       UUID NOT NULL,
    created_by_name  VARCHAR(150) NOT NULL,
    reason           VARCHAR(250),
    note             TEXT,
    total_qty        NUMERIC(18, 3) NOT NULL DEFAULT 0,
    total_value      NUMERIC(18, 0) NOT NULL DEFAULT 0,
    completed_at     TIMESTAMPTZ,
    cancelled_at     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_stock_issues_type_issued ON stock_issues (type, issued_at DESC);

CREATE TABLE stock_issue_lines (
    id               UUID PRIMARY KEY,
    issue_id         UUID NOT NULL REFERENCES stock_issues (id) ON DELETE CASCADE,
    line_no          INT NOT NULL,
    product_id       UUID NOT NULL REFERENCES products (id),
    unit_id          UUID NOT NULL REFERENCES product_units (id),
    conversion_rate  NUMERIC(18, 4) NOT NULL,
    quantity         NUMERIC(18, 3) NOT NULL,
    unit_cost        NUMERIC(18, 4) NOT NULL DEFAULT 0, -- giá vốn / 1 đơn vị đã chọn
    lot_number       VARCHAR(50),
    expiry_date      DATE
);
CREATE INDEX idx_stock_issue_lines_issue ON stock_issue_lines (issue_id);
