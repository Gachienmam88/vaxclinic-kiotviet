-- Thông báo gửi riêng cho 1 user (VD "Xác thực 2 lớp của bạn đã được đặt lại"). NULL = theo chi nhánh / quyền như cũ.
ALTER TABLE notifications ADD COLUMN target_user_id UUID REFERENCES users (id) ON DELETE CASCADE;
CREATE INDEX idx_notifications_target ON notifications (target_user_id) WHERE target_user_id IS NOT NULL;
