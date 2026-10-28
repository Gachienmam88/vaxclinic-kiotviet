# Phase 01 — Nền tảng: repo, Docker, gateway, identity, FE shell

Priority: P0 | Status: in progress

## Requirements
- Điểm tiêm (branch): mã, tên, địa chỉ, SĐT, trạng thái. Mỗi điểm tiêm có kho riêng.
- User: username, họ tên, SĐT, vai trò, các điểm tiêm được làm việc, khóa/mở.
- Vai trò mặc định: ADMIN, MANAGER (quản lý điểm tiêm), RECEPTIONIST (tiếp đón), DOCTOR (bác sĩ sàng lọc), NURSE (điều dưỡng tiêm), CASHIER (thu ngân), STOREKEEPER (thủ kho).
- Quyền dạng chuỗi (`user.manage`, `branch.manage`, `screening.perform`…) gắn vào vai trò.
- Đăng nhập → access JWT 30' + refresh token 7 ngày (lưu DB, xoay vòng khi refresh), đăng xuất thu hồi.
- Admin đầu tiên tạo khi khởi động từ biến môi trường `ADMIN_USERNAME` / `ADMIN_PASSWORD`.

## Kiến trúc
- Gateway: Spring Cloud Gateway, verify JWT (HS256, secret chung `JWT_SECRET`), route `/api/**` theo service.
- Mỗi service cũng tự verify JWT (phòng thủ 2 lớp) qua auto-config trong `common-lib`.
- FE: route handler Next.js làm BFF → cookie httpOnly; middleware chặn trang khi chưa đăng nhập.

## Todo
- [x] Git repo + branch feature
- [x] backend parent pom + common-lib (lỗi chuẩn, security JWT)
- [x] gateway-service
- [x] identity-service (Flyway, entity, auth, user, branch, role)
- [x] docker-compose infra + Dockerfile dùng chung
- [x] FE: Next.js, đăng nhập, layout, trang người dùng / điểm tiêm
- [x] Build + chạy thử end-to-end (curl qua gateway + BFF)
- [ ] Unit/integration test tự động (Testcontainers) — chưa viết
- [ ] Bố cục UI theo ảnh chụp user gửi
- [ ] Docker image backend: Dockerfile đã viết nhưng chưa build thử

## Success criteria
- `docker compose up -d` + chạy service → đăng nhập admin trên web → xem danh sách user, điểm tiêm.
