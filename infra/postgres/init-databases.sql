-- Mỗi microservice sở hữu 1 database riêng (không join chéo; trao đổi qua API/event).
CREATE DATABASE identity_db;
CREATE DATABASE catalog_db;
CREATE DATABASE inventory_db;
CREATE DATABASE patient_db;
CREATE DATABASE clinical_db;
CREATE DATABASE sales_db;
CREATE DATABASE report_db;
CREATE DATABASE integration_db;
