-- "Tự động phát hành HĐĐT khi hoàn thành hóa đơn" (cần app.events.enabled=true: sự kiện invoice.completed từ sales-service).
-- Mặc định TẮT: phát hành hóa đơn thuế tự động là quyết định nghiệp vụ của cửa hàng.
ALTER TABLE einvoice_settings ADD COLUMN auto_publish BOOLEAN NOT NULL DEFAULT FALSE;
