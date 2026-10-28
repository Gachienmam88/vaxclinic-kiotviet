-- Mỗi microservice sở hữu 1 database riêng (không join chéo; trao đổi qua API/event).
-- product_db = hàng hóa + kho (gộp để lọc theo tồn và cập nhật tồn/thẻ kho trong 1 transaction).
CREATE DATABASE identity_db;
CREATE DATABASE product_db;
CREATE DATABASE patient_db;
CREATE DATABASE clinical_db;
CREATE DATABASE sales_db;
CREATE DATABASE report_db;
CREATE DATABASE integration_db;
