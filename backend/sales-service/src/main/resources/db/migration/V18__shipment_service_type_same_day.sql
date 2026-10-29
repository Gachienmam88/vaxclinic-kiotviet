-- Loại dịch vụ tự giao thêm "Giao trong ngày" (SAME_DAY), như KiotViet.
ALTER TABLE shipments DROP CONSTRAINT IF EXISTS shipments_service_type_check;
ALTER TABLE shipments ADD CONSTRAINT shipments_service_type_check CHECK (service_type IN ('STANDARD', 'EXPRESS', 'SAME_DAY'));
