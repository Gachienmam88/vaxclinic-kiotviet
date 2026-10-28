# VaxClinic — Quản lý kinh doanh vắc xin & dịch vụ tiêm chủng

Hệ thống nội bộ cho doanh nghiệp tiêm chủng nhiều điểm tiêm: danh mục vắc xin, kho theo lô/HSD, hồ sơ tiêm chủng,
quy trình tiếp đón → sàng lọc → thu ngân → tiêm → theo dõi, báo cáo. Kế hoạch: `plans/261028-vaccination-clinic-platform/plan.md`.

## Kiến trúc
```
Browser ──▶ Next.js (frontend, BFF giữ JWT trong cookie httpOnly)
              │  /api/backend/*  (proxy, tự refresh token)
              ▼
         gateway-service :8080 (verify JWT, routing)
              ▼
         identity-service :8081 ──▶ PostgreSQL identity_db
         (các service khác thêm dần theo phase, mỗi service 1 database)
```
- Backend: Java 17, Spring Boot 3.5, Spring Cloud Gateway, Spring Security (JWT HS256), JPA + Flyway, Maven multi-module (`backend/`).
- Frontend: Next.js 15 App Router, Tailwind 4, shadcn/ui (Base UI), TanStack Query (`frontend/`).
- Hạ tầng dev: Docker Compose (Postgres 16, Redis, RabbitMQ, MinIO).

## Chạy trên máy dev
1. `cp .env.example .env` rồi điền secret (JWT_SECRET ≥ 32 ký tự, ADMIN_PASSWORD ≥ 8 ký tự). Cổng bị trùng thì đổi `POSTGRES_PORT`, `GATEWAY_PORT`.
2. Hạ tầng: `docker compose up -d`
3. Backend:
   ```powershell
   cd backend; mvn package -DskipTests; cd ..
   ./scripts/run-backend-service-locally.ps1 identity-service   # cửa sổ 1
   ./scripts/run-backend-service-locally.ps1 gateway-service    # cửa sổ 2
   ```
   Hoặc chạy hết bằng Docker: `docker compose --profile app up -d --build`.
4. Frontend: tạo `frontend/.env.local` với `GATEWAY_URL=http://localhost:<GATEWAY_PORT>`, rồi `cd frontend; npm install; npm run dev`.
5. Mở http://localhost:3000, đăng nhập `ADMIN_USERNAME` / `ADMIN_PASSWORD` (admin được tạo tự động lần đầu chạy).

Triển khai trong mạng LAN không có HTTPS (truy cập `http://192.168.x.x`): đặt `COOKIE_SECURE=false` cho frontend,
nếu không trình duyệt sẽ không lưu cookie đăng nhập. Khuyến nghị dùng HTTPS thay vì tắt cờ này.

## Quy ước
- Lỗi API thống nhất: `{ code, message, details[], timestamp }` (message tiếng Việt để hiển thị).
- Phân quyền: chuỗi permission trong JWT (`user.manage`, `screening.perform`…), định nghĩa tại `identity-service/.../role/Permissions.java`.
- Không commit `.env`, `.env.local`.
