-- ===== Nhân viên (HR): hồ sơ, ca, lịch làm việc, chấm công, bảng lương, hoa hồng =====
-- Thiết lập HR nằm trong app_settings với khóa hr.timekeeping / hr.payroll / hr.workdays / hr.holidays / hr.mobile / hr.templates.

CREATE TABLE hr_departments (
    id    UUID PRIMARY KEY,
    name  VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE hr_job_titles (
    id    UUID PRIMARY KEY,
    name  VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE hr_commission_tables (
    id          UUID PRIMARY KEY,
    name        VARCHAR(150) NOT NULL UNIQUE,
    active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Mức hoa hồng theo mặt hàng: PERCENT (% doanh thu) hoặc AMOUNT (số tiền / 1 đơn vị bán).
CREATE TABLE hr_commission_rules (
    table_id    UUID NOT NULL REFERENCES hr_commission_tables (id) ON DELETE CASCADE,
    product_id  UUID NOT NULL,
    rate_type   VARCHAR(10) NOT NULL,
    value       NUMERIC(18, 2) NOT NULL CHECK (value >= 0),
    PRIMARY KEY (table_id, product_id)
);

CREATE SEQUENCE hr_employee_code_seq START 1; -- NV000001

-- salary_type: SHIFT (theo ca) / HOUR (theo giờ) / STANDARD_DAY (theo ngày công chuẩn) / FIXED (cố định hàng tháng)
CREATE TABLE hr_employees (
    id                   UUID PRIMARY KEY,
    code                 VARCHAR(20)  NOT NULL UNIQUE,
    timekeeping_code     VARCHAR(30)  UNIQUE,
    name                 VARCHAR(150) NOT NULL,
    phone                VARCHAR(20),
    id_number            VARCHAR(20),
    birthday             DATE,
    gender               VARCHAR(10),
    start_date           DATE,
    main_branch_id       UUID REFERENCES branches (id),
    department_id        UUID REFERENCES hr_departments (id),
    job_title_id         UUID REFERENCES hr_job_titles (id),
    user_id              UUID UNIQUE REFERENCES users (id),
    status               VARCHAR(10)  NOT NULL DEFAULT 'WORKING', -- WORKING / QUIT
    note                 VARCHAR(500),
    salary_type          VARCHAR(20),
    salary_amount        NUMERIC(18, 0) NOT NULL DEFAULT 0,
    overtime_percent     NUMERIC(6, 2)  NOT NULL DEFAULT 150,
    commission_table_id  UUID REFERENCES hr_commission_tables (id) ON DELETE SET NULL,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_hr_employees_name ON hr_employees (lower(name));

CREATE TABLE hr_employee_branches (
    employee_id  UUID NOT NULL REFERENCES hr_employees (id) ON DELETE CASCADE,
    branch_id    UUID NOT NULL REFERENCES branches (id),
    PRIMARY KEY (employee_id, branch_id)
);

-- Phụ cấp (kind DAY: theo ngày làm việc / MONTH: cố định tháng) và giảm trừ (LATE / EARLY: mỗi lần, MONTH: cố định tháng).
CREATE TABLE hr_employee_pay_items (
    id           UUID PRIMARY KEY,
    employee_id  UUID NOT NULL REFERENCES hr_employees (id) ON DELETE CASCADE,
    item_type    VARCHAR(10)  NOT NULL, -- ALLOWANCE / DEDUCTION
    name         VARCHAR(100) NOT NULL,
    kind         VARCHAR(10)  NOT NULL,
    amount       NUMERIC(18, 0) NOT NULL CHECK (amount >= 0)
);
CREATE INDEX idx_hr_pay_items_employee ON hr_employee_pay_items (employee_id);

-- Ca làm việc. end_time < start_time = ca qua đêm (kết thúc ngày hôm sau).
CREATE TABLE hr_shifts (
    id          UUID PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    start_time  TIME NOT NULL,
    end_time    TIME NOT NULL,
    active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE hr_schedules (
    id           UUID PRIMARY KEY,
    employee_id  UUID NOT NULL REFERENCES hr_employees (id) ON DELETE CASCADE,
    shift_id     UUID NOT NULL REFERENCES hr_shifts (id),
    work_date    DATE NOT NULL,
    UNIQUE (employee_id, shift_id, work_date)
);
CREATE INDEX idx_hr_schedules_date ON hr_schedules (work_date);

-- Chấm công 1 nhân viên × ca × ngày. absence: PAID (nghỉ có phép) / UNPAID (nghỉ không phép).
-- source: MANUAL / PHONE (quét QR chi nhánh) / MACHINE (file máy chấm công) / AUTO (tự động chấm công).
CREATE TABLE hr_attendance (
    id           UUID PRIMARY KEY,
    employee_id  UUID NOT NULL REFERENCES hr_employees (id) ON DELETE CASCADE,
    shift_id     UUID NOT NULL REFERENCES hr_shifts (id),
    work_date    DATE NOT NULL,
    check_in     TIMESTAMPTZ,
    check_out    TIMESTAMPTZ,
    absence      VARCHAR(10),
    approved     BOOLEAN NOT NULL DEFAULT FALSE,
    source       VARCHAR(10) NOT NULL DEFAULT 'MANUAL',
    branch_id    UUID REFERENCES branches (id),
    note         VARCHAR(300),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (employee_id, shift_id, work_date)
);
CREATE INDEX idx_hr_attendance_date ON hr_attendance (work_date);

-- Tạm ứng (ADVANCE, tăng nợ) / khấu trừ khi trả lương (DEDUCT, giảm nợ). Số dư = "Nợ và tạm ứng".
CREATE TABLE hr_advances (
    id           UUID PRIMARY KEY,
    employee_id  UUID NOT NULL REFERENCES hr_employees (id) ON DELETE CASCADE,
    kind         VARCHAR(10) NOT NULL,
    amount       NUMERIC(18, 0) NOT NULL CHECK (amount > 0),
    occurred_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    payment_id   UUID,
    note         VARCHAR(300),
    created_by   UUID,
    cancelled    BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX idx_hr_advances_employee ON hr_advances (employee_id);

CREATE SEQUENCE hr_payroll_code_seq START 1;   -- BL000001
CREATE SEQUENCE hr_payment_code_seq START 1;   -- PCPL000001 (phiếu chi lương trong Sổ quỹ)

-- status: DRAFT (Đang tạo) / TEMP (Tạm tính) / LOCKED (Đã chốt lương) / CANCELLED (Đã hủy)
CREATE TABLE hr_payrolls (
    id               UUID PRIMARY KEY,
    code             VARCHAR(20)  NOT NULL UNIQUE,
    name             VARCHAR(150) NOT NULL,
    pay_cycle        VARCHAR(10)  NOT NULL DEFAULT 'MONTHLY',
    period_start     DATE NOT NULL,
    period_end       DATE NOT NULL,
    branch_id        UUID REFERENCES branches (id),
    status           VARCHAR(10)  NOT NULL,
    total            NUMERIC(18, 0) NOT NULL DEFAULT 0,
    paid             NUMERIC(18, 0) NOT NULL DEFAULT 0,
    note             VARCHAR(500),
    created_by       UUID,
    created_by_name  VARCHAR(150),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    computed_at      TIMESTAMPTZ,
    locked_at        TIMESTAMPTZ
);

-- Phiếu lương từng nhân viên; details: diễn giải tính lương (JSON) để xem chi tiết.
CREATE TABLE hr_payslips (
    id               UUID PRIMARY KEY,
    payroll_id       UUID NOT NULL REFERENCES hr_payrolls (id) ON DELETE CASCADE,
    employee_id      UUID NOT NULL REFERENCES hr_employees (id),
    employee_code    VARCHAR(20)  NOT NULL,
    employee_name    VARCHAR(150) NOT NULL,
    salary_type      VARCHAR(20),
    work_units       NUMERIC(10, 2) NOT NULL DEFAULT 0,
    base_amount      NUMERIC(18, 0) NOT NULL DEFAULT 0,
    overtime_amount  NUMERIC(18, 0) NOT NULL DEFAULT 0,
    holiday_amount   NUMERIC(18, 0) NOT NULL DEFAULT 0,
    allowance        NUMERIC(18, 0) NOT NULL DEFAULT 0,
    commission       NUMERIC(18, 0) NOT NULL DEFAULT 0,
    bonus            NUMERIC(18, 0) NOT NULL DEFAULT 0,
    deduction        NUMERIC(18, 0) NOT NULL DEFAULT 0,
    insurance        NUMERIC(18, 0) NOT NULL DEFAULT 0,
    tax              NUMERIC(18, 0) NOT NULL DEFAULT 0,
    total            NUMERIC(18, 0) NOT NULL DEFAULT 0,
    paid             NUMERIC(18, 0) NOT NULL DEFAULT 0,
    details          JSONB,
    UNIQUE (payroll_id, employee_id)
);

-- Thanh toán lương: cash_amount gửi Sổ quỹ (phiếu chi), advance_amount trừ vào "Nợ và tạm ứng".
CREATE TABLE hr_payroll_payments (
    id               UUID PRIMARY KEY,
    code             VARCHAR(20) NOT NULL UNIQUE,
    payroll_id       UUID NOT NULL REFERENCES hr_payrolls (id),
    payslip_id       UUID NOT NULL REFERENCES hr_payslips (id),
    employee_id      UUID NOT NULL REFERENCES hr_employees (id),
    cash_amount      NUMERIC(18, 0) NOT NULL DEFAULT 0,
    advance_amount   NUMERIC(18, 0) NOT NULL DEFAULT 0,
    method           VARCHAR(10) NOT NULL DEFAULT 'CASH',
    paid_at          TIMESTAMPTZ NOT NULL,
    created_by       UUID,
    created_by_name  VARCHAR(150),
    cancelled        BOOLEAN NOT NULL DEFAULT FALSE
);

-- Outbox: phiếu chi lương / tạm ứng gửi sang Sổ quỹ (sales-service /internal/cashflows), gửi lại tới khi thành công.
CREATE TABLE outbox_cashflows (
    id           UUID PRIMARY KEY,
    payload      TEXT        NOT NULL,
    attempts     INT         NOT NULL DEFAULT 0,
    last_error   TEXT,
    sent_at      TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_outbox_cashflows_pending ON outbox_cashflows (created_at) WHERE sent_at IS NULL;
