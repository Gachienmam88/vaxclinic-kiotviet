-- ===== Bán giao hàng như KiotViet: nhóm đối tác, loại đối tác, thông tin "Tự giao hàng" trên vận đơn =====

-- Nhóm đối tác giao hàng (ô "Nhóm đối tác" của form đối tác).
CREATE TABLE delivery_partner_groups (
    id          UUID PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    created_by  UUID,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ux_delivery_partner_groups_name ON delivery_partner_groups (lower(name));

-- Loại đối tác: PERSONAL (Cá nhân) / COMPANY (Công ty). partner_type (MANUAL) vẫn là kiểu kết nối.
ALTER TABLE delivery_partners
    ADD COLUMN partner_kind VARCHAR(10) NOT NULL DEFAULT 'PERSONAL' CHECK (partner_kind IN ('PERSONAL', 'COMPANY')),
    ADD COLUMN group_id UUID REFERENCES delivery_partner_groups (id) ON DELETE SET NULL;

-- Vận đơn "Tự giao hàng": loại dịch vụ, mã vận đơn của đối tác, thời gian giao hàng, kiện hàng (số kiện + kích thước cm),
-- bật/tắt thu hộ (tắt = phần khách chưa trả ghi công nợ khách, không thu hộ).
ALTER TABLE shipments
    ADD COLUMN service_type VARCHAR(20) NOT NULL DEFAULT 'STANDARD' CHECK (service_type IN ('STANDARD', 'EXPRESS')),
    ADD COLUMN waybill_code VARCHAR(50),
    ADD COLUMN expected_delivery_at TIMESTAMPTZ,
    ADD COLUMN package_count INT NOT NULL DEFAULT 1 CHECK (package_count >= 1),
    ADD COLUMN length_cm INT CHECK (length_cm >= 0),
    ADD COLUMN width_cm INT CHECK (width_cm >= 0),
    ADD COLUMN height_cm INT CHECK (height_cm >= 0),
    ADD COLUMN cod_enabled BOOLEAN NOT NULL DEFAULT TRUE;
CREATE INDEX idx_shipments_receiver_phone ON shipments (receiver_phone);
