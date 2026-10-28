-- Chủ gian hàng: đúng 1 user (vai trò ADMIN, đang hoạt động). Chỉ chủ gian hàng được đổi tên, bảo lưu, chuyển nhượng.
ALTER TABLE users ADD COLUMN owner BOOLEAN NOT NULL DEFAULT FALSE;
CREATE UNIQUE INDEX uq_users_single_owner ON users (owner) WHERE owner;
UPDATE users SET owner = TRUE WHERE id = (
    SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id
    WHERE r.code = 'ADMIN' AND u.active ORDER BY u.created_at LIMIT 1);

-- Xác thực 2 lớp (TOTP RFC 6238). secret_enc: AES-256-GCM, khóa dẫn xuất từ ENCRYPTION_KEY.
-- enabled = false: đã tạo mã QR nhưng chưa xác nhận. last_step: bước thời gian của mã đã dùng gần nhất (chống dùng lại).
-- failed_attempts / locked_until: nhập sai 5 lần → khóa nhập mã 5 phút.
CREATE TABLE user_totp (
    user_id          UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    secret_enc       TEXT        NOT NULL,
    enabled          BOOLEAN     NOT NULL DEFAULT FALSE,
    last_step        BIGINT,
    failed_attempts  INT         NOT NULL DEFAULT 0,
    locked_until     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    enabled_at       TIMESTAMPTZ
);

-- Mã khôi phục dùng 1 lần (chỉ lưu HMAC-SHA256).
CREATE TABLE user_recovery_codes (
    id         BIGSERIAL PRIMARY KEY,
    user_id    UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    code_hash  VARCHAR(64) NOT NULL,
    used_at    TIMESTAMPTZ
);
CREATE INDEX idx_recovery_codes_user ON user_recovery_codes (user_id);

-- Chấp thuận Điều khoản sử dụng theo phiên bản.
CREATE TABLE terms_acceptances (
    user_id      UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    version      VARCHAR(20) NOT NULL,
    accepted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, version)
);
