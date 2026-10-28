-- Điểm tiêm (chi nhánh). Mỗi điểm tiêm có kho vắc xin riêng (inventory-service tham chiếu branch.id).
CREATE TABLE branches (
    id          UUID PRIMARY KEY,
    code        VARCHAR(20)  NOT NULL UNIQUE,
    name        VARCHAR(200) NOT NULL,
    address     VARCHAR(500),
    phone       VARCHAR(20),
    active      BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Vai trò; system=true là vai trò mặc định, không cho xóa.
CREATE TABLE roles (
    id          UUID PRIMARY KEY,
    code        VARCHAR(50)  NOT NULL UNIQUE,
    name        VARCHAR(100) NOT NULL,
    system      BOOLEAN      NOT NULL DEFAULT FALSE
);

CREATE TABLE role_permissions (
    role_id     UUID        NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
    permission  VARCHAR(80) NOT NULL,
    PRIMARY KEY (role_id, permission)
);

CREATE TABLE users (
    id             UUID PRIMARY KEY,
    username       VARCHAR(50)  NOT NULL UNIQUE,
    password_hash  VARCHAR(100) NOT NULL,
    full_name      VARCHAR(150) NOT NULL,
    phone          VARCHAR(20),
    active         BOOLEAN      NOT NULL DEFAULT TRUE,
    role_id        UUID         NOT NULL REFERENCES roles (id),
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Điểm tiêm user được phép làm việc.
CREATE TABLE user_branches (
    user_id    UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    branch_id  UUID NOT NULL REFERENCES branches (id),
    PRIMARY KEY (user_id, branch_id)
);

-- Refresh token lưu dạng hash SHA-256, xoay vòng mỗi lần refresh.
CREATE TABLE refresh_tokens (
    id          UUID PRIMARY KEY,
    user_id     UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash  VARCHAR(64) NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked     BOOLEAN     NOT NULL DEFAULT FALSE
);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens (user_id);

-- Seed: điểm tiêm trung tâm + vai trò mặc định ngành tiêm chủng.
INSERT INTO branches (id, code, name) VALUES
    ('00000000-0000-0000-0000-000000000001', 'CN001', 'Điểm tiêm trung tâm');

INSERT INTO roles (id, code, name, system) VALUES
    ('00000000-0000-0000-0001-000000000001', 'ADMIN',        'Quản trị hệ thống', TRUE),
    ('00000000-0000-0000-0001-000000000002', 'MANAGER',      'Quản lý điểm tiêm', TRUE),
    ('00000000-0000-0000-0001-000000000003', 'RECEPTIONIST', 'Tiếp đón',          TRUE),
    ('00000000-0000-0000-0001-000000000004', 'DOCTOR',       'Bác sĩ khám sàng lọc', TRUE),
    ('00000000-0000-0000-0001-000000000005', 'NURSE',        'Điều dưỡng tiêm',   TRUE),
    ('00000000-0000-0000-0001-000000000006', 'CASHIER',      'Thu ngân',          TRUE),
    ('00000000-0000-0000-0001-000000000007', 'STOREKEEPER',  'Thủ kho',           TRUE);
