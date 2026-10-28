# Báo cáo (KiotViet-style) — báo cáo triển khai

## Nghiệp vụ / quy ước số liệu
- Mọi API nhận `from`/`to` = Instant [from, to) (màn hình cắt ngày theo giờ máy = giờ VN), `branchIds` luôn giao với claim `branches` của JWT (ngoài phạm vi → rỗng). Quyền `report.view`.
- Hóa đơn: chỉ COMPLETED; phiếu trả: COMPLETED. **Giá trị trả = tiền hàng trả − giảm giá phiếu trả**; phí trả hàng tách riêng (Phí trả hàng / Thu nhập khác (8)). → DT thuần báo cáo + phí trả = DT thuần Sổ S1a/S2a (đã kiểm thử).
- Doanh thu theo hàng: phân bổ giảm giá HĐ theo tỷ lệ tiền hàng (cùng công thức RevenueBookController). Giá vốn = Σ round(SL × giá vốn lúc bán) − hàng trả (khớp S2a).
- Cuối ngày: Thực thu = Σ phân bổ của phiếu thu (đã thanh toán, trong kỳ) vào HĐ; phiếu trả = −phiếu chi `PC{TH}`. Ghi nợ = doanh thu + phí − thực thu. Nhóm ngang: TM/CK/Thẻ/Ví/Ghi nợ (chưa thu), CK/Thẻ/Ví tách theo tài khoản "Ngân hàng - số TK - chủ TK" của phiếu thu. Thu khác/VAT/Làm tròn: app chưa có → 0.
- Người bán = `seller` của HĐ, chưa chọn thì người tạo. Kênh bán: HĐ không có trường kênh → mọi HĐ là "Bán trực tiếp" (ghi chú trên báo cáo).
- Tài chính (theo tháng, màn cộng ra quý/kỳ): (1) Σ tiền hàng, (2.1) giảm giá HĐ, (2.2) giá trị trả, (4) giá vốn, Xuất hủy (product-service), Chiết khấu thanh toán = sổ công nợ CKTT (không có chi nhánh → toàn cửa hàng), Chi trả lương NV = phiếu chi hạch toán có loại chứa "lương", (9) = phiếu chi hạch toán còn lại (trừ NCC/trả hàng/nhập) ⇒ lương + (9) = Σ chi phí sổ S2b; (8) = phí trả hàng + phiếu thu tay hạch toán. Voucher, phí ĐTGH, hoàn tiền, điểm, chênh lệch làm tròn = 0 (không có nguồn).
- NCC: giá trị = tổng phiếu (sau giảm giá, gồm VAT), dòng hàng phân bổ; công nợ = Σ(tổng nhập − đã trả) − Σ(tổng trả − NCC đã hoàn), phiếu hoàn thành. Thanh toán NCC ngoài phiếu nhập (nếu có ở Sổ quỹ) chưa tính.
- Bỏ qua / vô hiệu có ghi chú: Bảng giá (HĐ không lưu bảng giá → ô disabled + tooltip), Loại hàng & Thuộc tính (hàng hóa không có các trường này), Thời gian giao hàng (đơn chưa có ngày giao → chỉ "Toàn thời gian"). Trang chỉ 1 trang dài ("1 / 1"), hoàn tác/làm lại disabled.

## Backend
sales-service — package mới `com.vaxclinic.sales.report`: `ReportFilter`, `EndOfDayReportController`, `SalesSummaryReportController`, `ProductSalesReportController`, `OrderReportController`, `CustomerDebtReportController`, `FinanceReportController`.
- `GET /api/reports/end-of-day/sales` (customerId, sellerId, createdBy, methods, saleModes), `/end-of-day/cashflow` (+funds)
- `GET /api/reports/sales/summary?groupBy=DAY|SELLER|BRANCH|CUSTOMER|CHANNEL`, `/sales/products?by=NONE|CUSTOMER|SELLER&merge=&q=`
- `GET /api/reports/orders/products?statuses=&merge=&q=`, `/orders/transactions`
- `GET /api/reports/customers/debt?customerId=`, `GET /api/reports/finance`

product-service — package mới `com.vaxclinic.product.report` (chỉ THÊM file): `ProductReportScope`, `InventoryReportController`, `SupplierReportController`.
- `GET /api/reports/inventory/movement-detail`, `/inventory/damages`, `/inventory/damages/monthly`
- `GET /api/reports/suppliers/summary?byProduct=`, `/suppliers/debt`
- Xuất nhập tồn dùng lại `GET /api/accounting/stock/summary` (S2d) có sẵn.

Gateway (`gateway-service/.../application.yml`): route mới `product-reports` (`order: -1`, `/api/reports/inventory/**,/api/reports/suppliers/**` → product) đặt trước; route `sales` thêm `/api/reports/**`. **Chưa restart gateway — lead cần restart.**

Build: sales-service & product-service đã package + restart (product-service: health UP, không có mvn nào cho nó, jar cũ mới hơn mọi nguồn price-book → chỉ thêm file report).

## Frontend
Routes: `/reports/end-of-day|sales|orders|products|customers|suppliers|employees|channels|finance` (`app/(admin)/reports/*/page.tsx`).
`features/reports/`: `report-api.ts`, `report-time-presets.ts`, `report-time-filter.tsx` (mốc Hôm nay…Năm trước + Tùy chỉnh; ngày + Từ/Đến giờ), `report-sidebar-kit.tsx`, `report-viewer.tsx` (thanh công cụ xám + tờ A4 dọc/ngang, zoom, toàn màn hình, in qua iframe sandbox, xuất CSV qua `downloadCsv`), `report-print.ts`, `report-table.tsx` (dòng tổng/nhóm ⊞⊟), `report-charts.tsx` (cột/thanh/tròn thuần CSS-SVG, không thêm thư viện), `summary-table-kit.tsx`, `end-of-day-*.tsx`, `sales-report.tsx`, `orders-report.tsx`, `products-report{,-tables}.tsx`, `party-report{,-configs}.{tsx,ts}` (khách hàng / nhân viên / kênh bán), `suppliers-report.tsx`, `finance-report.tsx`. Mọi file < 200 dòng.

Menu (lead thêm vào `app-header-nav-menu.tsx`, mục "Báo cáo", perm `report.view`, danh sách phẳng như KiotViet):
Cuối ngày `/reports/end-of-day` · Bán hàng `/reports/sales` · Đặt hàng `/reports/orders` · Hàng hóa `/reports/products` · Khách hàng `/reports/customers` · Nhà cung cấp `/reports/suppliers` · Nhân viên `/reports/employees` · Kênh bán hàng `/reports/channels` · Tài chính `/reports/finance`.

## Kiểm thử
- `mvn -q -o -pl sales-service -am package`, `-pl product-service -am package` OK; `npx tsc --noEmit -p .` sạch; `npx eslint src/features/reports src/app/(admin)/reports` sạch.
- `scratchpad/e2e_reports.py` (+ `e2e_reports_checks.py`): **31/31 PASS** — cuối ngày (thực thu TM/CK = Σ phiếu thu−chi theo quỹ, tài khoản CK, lọc phương thức), theo khách/hàng/ngày/kênh/chi nhánh/người bán, khớp Sổ S1a/S2a (DT, giá vốn), khớp danh sách HĐ, tài chính (1)(2.1)(4), lương+(9)=chi phí S2b, đặt hàng, công nợ khách = hồ sơ khách, xuất hủy, XNT chi tiết = tồn kho, NCC nhập/công nợ, 400 tham số sai, chi nhánh ngoài phạm vi. Tự dọn dữ liệu (đã xác minh).

## Câu hỏi còn mở
- Phiếu chi lương của module HR: đang nhận theo loại thu chi chứa "lương" — HR agent dùng đúng tên loại? (nếu khác cần thống nhất).
- Có cần lưu kênh bán / bảng giá áp dụng / ngày giao hàng trên HĐ & đơn để bật các bộ lọc đang vô hiệu?
- Công nợ NCC chỉ tính theo phiếu nhập/trả; nếu Sổ quỹ có phiếu chi trả nợ NCC riêng thì cần nguồn chung.
- Phân trang thật cho báo cáo rất dài (hiện 1 trang cuộn).
