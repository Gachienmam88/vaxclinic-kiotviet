-- Quyền mặc định cho các vai trò hệ thống (ngoài ADMIN — ADMIN luôn được bơm đủ quyền lúc khởi động).
-- Chỉ thêm cho vai trò CHƯA có quyền nào: vai trò cửa hàng đã tự chỉnh thì giữ nguyên.
WITH defaults (role_code, permission) AS (
    VALUES
        -- Quản lý điểm tiêm: vận hành toàn bộ điểm tiêm, không quản trị người dùng / chi nhánh / thiết lập
        ('MANAGER', 'catalog.view'), ('MANAGER', 'catalog.manage'),
        ('MANAGER', 'inventory.view'), ('MANAGER', 'inventory.manage'),
        ('MANAGER', 'patient.view'), ('MANAGER', 'patient.manage'),
        ('MANAGER', 'reception.perform'), ('MANAGER', 'screening.perform'), ('MANAGER', 'injection.perform'),
        ('MANAGER', 'sales.perform'), ('MANAGER', 'sales.cancel'), ('MANAGER', 'cashbook.manage'),
        ('MANAGER', 'report.view'), ('MANAGER', 'hr.manage'),
        -- Tiếp đón: tra cứu vắc xin, tạo / sửa hồ sơ khách, tiếp đón
        ('RECEPTIONIST', 'catalog.view'), ('RECEPTIONIST', 'patient.view'), ('RECEPTIONIST', 'patient.manage'),
        ('RECEPTIONIST', 'reception.perform'),
        -- Bác sĩ khám sàng lọc: xem hồ sơ, khám sàng lọc
        ('DOCTOR', 'catalog.view'), ('DOCTOR', 'patient.view'), ('DOCTOR', 'screening.perform'),
        -- Điều dưỡng tiêm: xem hồ sơ + tồn kho lô/HSD, tiêm
        ('NURSE', 'catalog.view'), ('NURSE', 'inventory.view'), ('NURSE', 'patient.view'), ('NURSE', 'injection.perform'),
        -- Thu ngân: bán hàng / đặt hàng / trả hàng, tạo khách tại quầy; hủy hóa đơn và sổ quỹ do quản lý
        ('CASHIER', 'catalog.view'), ('CASHIER', 'patient.view'), ('CASHIER', 'patient.manage'), ('CASHIER', 'sales.perform'),
        -- Thủ kho: nhập / trả hàng nhập / kiểm kho / xuất hủy, NCC
        ('STOREKEEPER', 'catalog.view'), ('STOREKEEPER', 'inventory.view'), ('STOREKEEPER', 'inventory.manage')
)
INSERT INTO role_permissions (role_id, permission)
SELECT r.id, d.permission
FROM defaults d
JOIN roles r ON r.code = d.role_code AND r.system
WHERE NOT EXISTS (SELECT 1 FROM role_permissions p WHERE p.role_id = r.id);
