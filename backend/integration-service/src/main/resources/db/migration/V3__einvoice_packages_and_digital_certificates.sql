-- Hồ sơ cửa hàng → Hóa đơn điện tử: gói hóa đơn mua của nhà phát hành (MISA). Nhập tay vì chưa tích hợp API hạn mức của MISA.
-- "Đã dùng" của mỗi gói = số HĐĐT đã phát hành (einvoice_records PUBLISHED) phân bổ theo ngày phát hành vào gói còn hiệu lực.
CREATE TABLE einvoice_packages (
    id          UUID PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    quantity    INT          NOT NULL CHECK (quantity > 0),
    start_date  DATE         NOT NULL,
    end_date    DATE         NOT NULL CHECK (end_date >= start_date),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Hồ sơ cửa hàng → Quản lý chữ ký số: thông tin chứng thư số dùng ký HĐĐT. Chỉ lưu chứng thư công khai (.cer, DER), không bao giờ lưu khóa bí mật.
CREATE TABLE digital_certificates (
    id              UUID PRIMARY KEY,
    subject_name    VARCHAR(300) NOT NULL,
    tax_code        VARCHAR(20),
    representative  VARCHAR(150),
    signature_type  VARCHAR(20)  NOT NULL,             -- USB_TOKEN / HSM / RMS
    provider        VARCHAR(100),
    serial_number   VARCHAR(100),
    activated_on    DATE,
    expires_on      DATE         NOT NULL,
    cert_status     VARCHAR(20)  NOT NULL DEFAULT 'APPROVED', -- PENDING / APPROVED / REVOKED
    active          BOOLEAN      NOT NULL DEFAULT TRUE,
    issuer          VARCHAR(500),
    cert_der        BYTEA,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);
