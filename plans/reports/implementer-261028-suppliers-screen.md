# Implementer — Màn Nhà cung cấp (KiotViet) + sổ công nợ NCC — 2026-10-28

Status: DONE_WITH_CONCERNS (xem Câu hỏi mở)

## Backend product-service (`com.vaxclinic.product.purchase`)
- `V6__supplier_groups_and_debt_ledger.sql`: `supplier_groups` (migrate từ `suppliers.group_name` → `group_id`, drop cột cũ); suppliers + `branch_id, created_by, created_by_name`; `supplier_debt_docs` (PAYMENT `PCN000001` / `PC{mã PN}`, DISCOUNT `CKN…`, ADJUSTMENT `DCN…`, status ACTIVE/CANCELLED, `cash_source_id`) + `supplier_debt_allocations` (doc × phiếu nhập). FK cascade để script dọn dữ liệu cũ vẫn chạy.
- Đối soát dữ liệu cũ: mỗi phiếu nhập đã hoàn thành có `paid_amount > 0` → doc `PC{mã PN}` + phân bổ đúng phiếu (hủy nếu phiếu đã hủy). Sau migrate: 12 doc ACTIVE = 24,000,000 = đúng 12 phiếu chi PURCHASE PAID trong sales_db; 0 phiếu lệch `paid_amount`.
- Quy tắc: `paid_amount` = Σ phân bổ thanh toán còn hiệu lực; "Còn cần trả" = tổng − Σ phân bổ (thanh toán + chiết khấu). Phân bổ khóa dòng phiếu nhập `FOR UPDATE`, mỗi dòng ≤ còn cần trả, tổng ≤ số tiền; `allocations=null` → tự phân bổ cũ trước; phần dư = chưa phân bổ (nợ có thể âm). Hủy phiếu nhập → phiếu chi lúc nhập hủy theo, phân bổ của phiếu chi khác thành chưa phân bổ.
- Sổ công nợ (`SupplierListQuery.LEDGER`): nhập +tổng, trả hàng −(tổng − NCC hoàn), thanh toán/chiết khấu −, điều chỉnh ±. Số dư lũy kế bằng window function.
- File mới: `SupplierGroupController`, `SupplierCommandService`, `SupplierListQuery`, `SupplierImportService`, `SupplierFileParser` (CSV + XLSX bằng JDK zip/DOM, chặn XXE — không thêm thư viện vì build offline), `SupplierDebtDtos`, `SupplierDebtQuery`, `SupplierDebtService`, `SupplierDebtAllocator`, `SupplierDebtController`. Sửa: `Supplier`, `SupplierController`, `SupplierRepository`, `PurchaseReceiptService` (chặn NCC ngừng hoạt động ở phiếu mới; hook ledger khi hoàn thành/hủy), `internal/CashflowOutbox` (+ supplierPayment / Updated / Cancelled), `report/SupplierReportController` (công nợ NCC tính cả thanh toán/chiết khấu/điều chỉnh — **đã sửa lỗi ghi trong report module**).
- Khóa sổ (`checkNotLocked`) cho tạo / sửa thời gian (cả mốc cũ + mới) / hủy; audit log mọi thao tác ghi (feature "Nhà cung cấp"); quyền: xem `catalog.view`, ghi `inventory.manage`.

## Routes (đều dưới `/api/suppliers/**` → **không cần sửa / restart gateway**)
`GET /api/suppliers?q&groupId&active&buyFrom&buyTo&from&to&debtFrom&debtTo&page&size` (→ items + sumDebt + sumTotalBuy) · `GET/PUT/DELETE /api/suppliers/{id}` · `PATCH /{id}/note` · `PATCH /{id}/status` · `POST /api/suppliers/import` (multipart `file`) · `GET/POST /api/suppliers/groups`, `PUT/DELETE /api/suppliers/groups/{id}` · `GET /{id}/debts|history|unpaid-receipts` · `POST /{id}/payments|discounts|adjustments` · `GET/PATCH /api/suppliers/debt-docs/{docId}`, `POST /api/suppliers/debt-docs/{docId}/cancel`.
Tương thích cũ: request vẫn nhận `groupName` (tìm hoặc tạo nhóm). Ô chọn NCC ở phiếu nhập (`useSuppliers`) giờ gửi `active=true`.

## Sổ quỹ ↔ công nợ NCC (sales-service, sửa tối thiểu)
- Phiếu chi từ màn NCC đi qua outbox, `sourceType=PURCHASE`, `sourceId=id doc` (phiếu lúc nhập vẫn `sourceId=id phiếu nhập`) → dùng lại unique index, chặn hủy tay, loại khỏi chi phí ở báo cáo tài chính / sổ S2b sẵn có.
- `CashbookService`: inbound thêm `bankAccountId` + action `UPDATE` (thời gian, người chi, ghi chú); **chặn tạo phiếu thu/chi tay với đối tượng Nhà cung cấp** (`SUPPLIER_VOUCHER_VIA_SUPPLIER_SCREEN`). Lý do chọn chặn thay vì đồng bộ: Sổ quỹ chỉ lưu `partner_type/partner_id` dạng chữ, UI cũ không chọn được NCC (partner_id luôn null) nên không gắn được vào công nợ; đồng bộ ngược sales→product cần thêm outbox thứ hai + xử lý hủy/sửa 2 chiều. Giữ product-service là nơi duy nhất ghi công nợ NCC → hai sổ luôn khớp. DB hiện có 0 phiếu tay đối tượng NCC → không cần đối soát. `cash-voucher-dialog.tsx`: chọn "Nhà cung cấp" hiện hướng dẫn + link sang màn NCC, nút Lưu khóa.
- Đã build + restart sales-service (8086) và product-service (8082).

## Báo cáo tài chính
`FinanceReportController` không có dòng "chiết khấu thanh toán nhận từ NCC" (chỉ "Chiết khấu thanh toán cho khách") → theo yêu cầu không thêm; không tạo endpoint report mới. Chiết khấu NCC chỉ giảm nợ, không có phiếu Sổ quỹ.

## Frontend (`features/purchases/supplier-*`, mọi file < 200 dòng)
`app/(admin)/purchases/suppliers/page.tsx` + `supplier-types.ts`, `supplier-queries.ts`, `supplier-list-toolbar.tsx` (tìm + nút ẩn/hiện bộ lọc, + Nhà cung cấp, Import file, Xuất file (đã chọn hoặc toàn bộ kết quả lọc), chọn cột (lưu localStorage), cài đặt số dòng, trợ giúp), `supplier-list-columns.ts`, `supplier-list-table.tsx` (ô chọn, dòng tổng, viền xanh dòng + panel, bấm lại dòng đóng), `supplier-filter-sidebar.tsx`, `supplier-group-dialog.tsx`, `supplier-form-dialog.tsx` (chọn nhóm theo id), `supplier-detail-panel.tsx` (`DetailTabsList` → bấm lại tab đang mở đóng panel), `supplier-detail-info-tab.tsx` (ghi chú sửa tại chỗ, Thêm thông tin xuất hóa đơn, Xóa / Chỉnh sửa / Ngừng – Cho phép hoạt động), `supplier-detail-history-tab.tsx`, `supplier-detail-debt-tab.tsx` (lọc loại, pager 5 dòng "1 - 5 trong N dòng", Xuất file công nợ / Xuất file), `supplier-payment-dialog.tsx` (Thanh toán + Chiết khấu thanh toán), `supplier-allocation-table.tsx`, `supplier-allocation-math.ts`, `supplier-adjust-dialog.tsx`, `supplier-debt-doc-dialog.tsx` (Phiếu chi: sửa thời gian/nhân viên/ghi chú, In, Hủy), `supplier-doc-opener.tsx`, `supplier-mini-pager.tsx`, `supplier-confirm-dialog.tsx`, `supplier-import-dialog.tsx` (file CSV mẫu, lỗi theo dòng), `supplier-payment-print.ts` (in theo mẫu Phiếu chi, không chờ Sổ quỹ đồng bộ). Rỗng dùng `ListEmptyState`. Xóa `exportSuppliersCsv` (không còn dùng).
Khu vực / Phường-Xã: repo chưa có danh mục hành chính 2025 → ô nhập tay, nhãn giữ nguyên.

## Kiểm thử
- `mvn -q -o -pl product-service,sales-service -am package -DskipTests` OK; `npx tsc --noEmit -p .` sạch; `npx eslint src/features/purchases src/app/(admin)/purchases/suppliers src/features/sales/cash-voucher-dialog.tsx` sạch.
- `scratchpad/e2e_suppliers.py`: **54/54 PASS** (nhóm CRUD, tạo/sửa/trùng mã/ghi chú/lọc, sổ công nợ lũy kế, phân bổ tay chặn vượt, tự phân bổ, trả dư → nợ âm, phiếu chi Sổ quỹ TM/CK, hủy + sửa phiếu đồng bộ Sổ quỹ, điều chỉnh, chiết khấu có phân bổ (không phiếu Sổ quỹ), báo cáo công nợ NCC = sổ, ngừng hoạt động chặn phiếu nhập, xóa có/không giao dịch, import CSV + XLSX, Sổ quỹ chặn phiếu NCC tay, hủy phiếu nhập, khóa sổ tạo/hủy/dời ngày, audit). Dọn dữ liệu xác minh = 0 bản ghi sót; khóa sổ trả lại `{enabled: false}`.
- Chạy lại: `e2e_purchasing.py` 21/21, `e2e_reports.py` 34/34.

## Câu hỏi mở
- "Tổng mua" đang = Σ phiếu nhập − Σ phiếu trả hàng nhập (hoàn thành). KiotViet có trừ trả hàng không? Nếu không, bỏ phần trả ở `SupplierListQuery.base`.
- Trả hàng nhập: sổ công nợ ghi 1 dòng −(tổng − NCC đã hoàn); KiotViet có thể tách dòng tiền NCC hoàn. Cần thì tách.
- Mã phiếu: thanh toán từ màn NCC `PCN000001`, chiết khấu `CKN…`, điều chỉnh `DCN…` (tránh trùng `PC000001` phiếu tay Sổ quỹ). Đổi nếu muốn khớp KiotViet hơn.
- Báo cáo tài chính chưa có dòng "Chiết khấu thanh toán nhận từ NCC" — có muốn thêm (thu nhập khác) không?
- Import XLSX đọc sheet `sheet1.xml`; SĐT lưu dạng số trong Excel mất số 0 đầu (khuyên định dạng ô Text). Danh mục Tỉnh/Phường 2025 chưa có.
- Chưa chạy code-reviewer agent (không có trong danh sách agent của phiên này).
