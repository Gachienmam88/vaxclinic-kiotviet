# Phase 02 — Hàng hóa + kho (product-service)

Priority: P0 | Status: in progress (core done 2026-10-28)

## Quyết định
- Gộp catalog + inventory thành `product-service` (port 8082, `product_db`): lọc danh sách theo tồn kho và ghi tồn + thẻ kho cần cùng 1 transaction.
- Mỗi đơn vị tính = 1 mã hàng (SP000001 Liều, SP000002 Hộp). Tồn / giá vốn / định mức tính theo đơn vị cơ bản.
- 2 loại hàng: quản lý theo lô + HSD (tồn theo lô, FEFO) và không theo lô.
- Giá vốn bình quân gia quyền, chỉ thay đổi khi nhập; nhập tay được khi hàng chưa có giao dịch kho.
- Mọi thay đổi tồn đi qua `StockMovementService` (khóa dòng tồn, ghi thẻ kho bất biến).

## Done
- [x] Nhóm hàng (cây cha/con), tỷ lệ thuế (seed), vị trí
- [x] CRUD hàng hóa, đơn vị quy đổi, tồn đầu kỳ (theo lô hoặc không), ngừng kinh doanh, xóa mềm
- [x] Danh sách + bộ lọc: nhóm hàng, thuế, giảm thuế, tồn kho, thời gian tạo, trạng thái; tìm theo tên/mã/mã vạch
- [x] Chi tiết tab: Thông tin, Mô tả, Thẻ kho, Tồn kho (+ lô/HSD, cảnh báo cận hạn < 90 ngày), Hàng hóa cùng loại
- [x] E2E 16 kịch bản qua BFF (script ngoài repo)
- [x] Thiết lập giá (bảng giá theo chi nhánh / nhóm khách / người bán, công thức, nhập/xuất CSV, tự cập nhật theo giá chung, đưa vào danh mục màn bán hàng (sale)) — xem `plans/reports/implementer-261028-price-books.md`

## Chưa làm
- [ ] Ảnh hàng hóa (MinIO)
- [ ] Thuộc tính / biến thể
- [ ] Import / Xuất file Excel
- [ ] "Dự kiến hết hàng" (cần dữ liệu bán hàng)
- [ ] Liên kết kênh bán (Shopee/TikTok/Lazada/Tiki) — phase tích hợp
- [ ] Test tự động trong repo (JUnit + Testcontainers)
