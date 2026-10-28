-- Thiết lập cửa hàng dạng khóa → JSON: store (thông tin cửa hàng), sales (đơn hàng), customer (khách hàng), lock (khóa sổ).
CREATE TABLE app_settings (
    key         VARCHAR(50) PRIMARY KEY,
    value       JSONB       NOT NULL,
    updated_by  UUID,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE roles ADD COLUMN description VARCHAR(500);
