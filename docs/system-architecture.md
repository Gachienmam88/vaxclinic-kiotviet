# Kiến trúc hệ thống — VaxClinic

Cập nhật: 2026-10-29. Phân tích đầy đủ (đồng bộ/bất đồng bộ, Redis, ElasticSearch, Saga, CI/CD, lộ trình):
[plans/reports/architecture-261029-sync-async-redis-es-saga.md](../plans/reports/architecture-261029-sync-async-redis-es-saga.md)

## Thành phần

```
Trình duyệt ──▶ Next.js 15 (BFF, JWT trong cookie httpOnly, /sale bán offline)
                   │ /api/backend/*
                   ▼
              gateway-service (8080 trong compose; 8090 khi chạy scripts/start-all-local.ps1)
                   ▼
   identity-service :8081 → identity_db     người dùng, vai trò, thiết lập, nhân sự, thông báo, nhật ký, 2FA
   product-service  :8082 → product_db      hàng hóa, lô/HSD, thẻ kho, nhập hàng, NCC, bảng giá, phiếu kho
   sales-service    :8086 → sales_db        hóa đơn, trả hàng, đặt hàng, sổ quỹ, khách hàng, công nợ, giao hàng, báo cáo
   integration-svc  :8088 → integration_db  HĐĐT MISA, hóa đơn đầu vào cổng thuế, webhook SePay, chứng thư số
```

- 1 PostgreSQL 16, mỗi service 1 database (`infra/postgres/init-databases.sql`); không join chéo DB.
- Redis, RabbitMQ, MinIO có trong `docker-compose.yml` nhưng **chưa được code sử dụng**.
- Java 17, Spring Boot 3.5, Flyway chạy khi service khởi động; `common-lib` chứa client dùng chung.

## Giao tiếp giữa các service

| Kiểu | Luồng | File chính |
|---|---|---|
| Đồng bộ, idempotent | sales → product `/internal/stock-docs` (bán / sửa / hủy / trả hàng), khóa `(doc_id, doc_type)` | `sales/invoice/ProductStockClient.java`, `product/internal/InternalStockService.java` |
| Đồng bộ + cache 30 s | sales, product → identity `/internal/settings` | `common-lib/.../settings/ShopSettingsClient.java` |
| Đồng bộ | sales → integration (HĐ đã phát hành HĐĐT?), identity → sales (doanh thu người bán), integration → sales → MISA | `sales/common/SalesRules.java`, `identity/hr/commission/SellerRevenueClient.java`, `integration/einvoice/EInvoiceService.java` |
| Outbox (bất đồng bộ) | product → sales phiếu chi trả NCC; identity → sales phiếu chi lương | `product/internal/CashflowOutbox.java`, `identity/hr/HrCashflowOutbox.java` |
| Hàng đợi RAM | mọi service → identity nhật ký thao tác | `common-lib/.../audit/HttpAuditLogger.java` |
| Job định kỳ | cảnh báo hộp thư (15 phút; SePay 1 phút), bảng lương (6 h), chấm công (1 h) | `*/notification/*AlertJob.java`, `identity/hr/HrJobs.java` |
| Offline phía client | `/sale` → localStorage → POST lại cùng id mỗi 15 s | `frontend/src/features/sale/use-offline-queue.ts` |

## Quy tắc thiết kế đang áp dụng

- Người dùng cần câu trả lời đúng ngay (tồn kho khi bán, HĐĐT đã phát hành) → gọi đồng bộ; hệ quả phụ (sổ quỹ, cảnh báo, nhật ký) → bất đồng bộ.
- Mọi lệnh có thể bị gửi lại đều idempotent theo id do client sinh hoặc id suy ra (`UUID.nameUUIDFromBytes`).
- Ghi nghiệp vụ + outbox trong cùng transaction; bên nhận chống trùng theo `(sourceType, sourceId, action)`.
- Migration Flyway phải tương thích ngược (expand → contract) để quay lại ảnh cũ được.

## Hạn chế đã biết (xem lộ trình trong báo cáo)

- `RestClient` nội bộ không đặt timeout (chỉ gateway có).
- Chưa có đối soát khi kho đã trừ nhưng lưu hóa đơn lỗi và không được gửi lại.
- Đăng nhập mật khẩu giới hạn số lần sai theo tên đăng nhập (identity) + rate limit theo IP/user ở gateway (RAM, mỗi instance riêng).
- Tìm kiếm dùng `ILIKE`, phân biệt dấu ở màn quản trị.
- Chưa có CI/CD; thư mục dự án chưa là git repo.
