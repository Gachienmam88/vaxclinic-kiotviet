# Hóa đơn (danh sách + chi tiết) theo KiotViet: báo cáo triển khai

## Nghiệp vụ đã chọn
- **Trạng thái hóa đơn kiểu KiotViet** tính từ dữ liệu có sẵn, không thêm cột: Đã hủy = `invoices.status = CANCELLED`; Không giao được = vận đơn đang hoạt động ở RETURNING/RETURNED; Đang xử lý = vận đơn PENDING/PICKING/DELIVERING; còn lại = Hoàn thành. Cùng một quy tắc ở backend (`InvoiceFilterSql.STATE`) và frontend (`invoiceState()`).
- **Mặc định sidebar**: Tháng này; Trạng thái = Đang xử lý + Hoàn thành; Trả hàng = cả hai ô được chọn (không lọc). Link sâu → Toàn thời gian + mọi trạng thái.
- **HĐĐT** (integration-service `einvoice_records`): chưa có bản ghi → "Chưa phát hành"; PUBLISHED + có `inv_code` (mã CQT) → "CQT chấp nhận"; PUBLISHED, chưa có mã → "Đã phát hành"; FAILED → "Phát hành lỗi".
- **Tính chất hóa đơn**: hệ thống chỉ phát hành hóa đơn gốc. Gốc = đã phát hành; Điều chỉnh / Thay thế → không có kết quả.
- **Giảm thuế** = tổng tiền hàng − giảm giá − khách cần trả (≥ 0), vì hóa đơn chưa lưu trường giảm thuế riêng.
- **☆ đánh dấu + cột hiển thị**: lưu localStorage, khóa `kv.invoices.{favourites|columns}.{userId}`, theo từng máy và không đồng bộ. Bấm ☆ ở tiêu đề → chỉ xem hóa đơn đã đánh dấu (lọc ở server qua `ids`).

## Backend
sales-service:
- Tạo mới `invoice/InvoiceFilterSql.java` (mệnh đề where + biểu thức trạng thái) và `invoice/EInvoiceLookupClient.java` (gọi integration `/internal/einvoices/statuses`, chỉ khi có lọc HĐĐT hoặc tính chất; nếu lỗi → 503 EINVOICE_SERVICE_DOWN).
- Sửa `InvoiceQuery.java` (Filter thêm trường; giữ constructor cũ), `InvoiceController.java`, `InvoiceDtos.java`, `InvoiceService.java`, `InvoiceWriter.java`.
- `GET /api/invoices` có thêm tham số: `ids`, `states`, `deliveries` (DELIVERY/NONE), `returnStates` (HAS/NONE), `einvoiceStatuses` (NONE/PUBLISHED/ACCEPTED/FAILED), `einvoiceNatures` (ORIGINAL/ADJUST/REPLACE), `customerQ`, `productQ`, `noteQ`. Mỗi dòng trả thêm `state`, `saleMode`, `returnCodes`.
- `PATCH /api/invoices/{id}/info` nhận thêm `salesChannel` (null = giữ nguyên; kiểm tra qua `SalesChannels.resolve`). Audit ghi kênh bán. Quy tắc khóa đổi thời gian giao dịch không đổi; frontend chỉ gửi `soldAt` khi thời gian thực sự thay đổi.
- Test: `src/test/.../invoice/InvoiceFilterSqlTest.java`, 5/5 PASS.

integration-service: `EInvoiceController` thêm `GET /internal/einvoices/statuses` (quyền `internal`).

Đã build cả hai bằng một lần chạy mvn (`-pl sales-service,integration-service -am`, đã kiểm tra trước là không có mvn nào khác đang chạy) và đã khởi động lại :8086 và :8088.

## Frontend
- `app/(admin)/invoices/page.tsx`: hỗ trợ `/invoices?code=HD…` (không phân biệt hoa thường, nhận cả `Code`) và `?id=`. Trang lọc theo hóa đơn đó và mở sẵn dòng chi tiết. Có Suspense; đổi query thì trang dựng lại.
- Tạo mới trong `features/sales/`: `invoice-filter-model.ts`, `invoice-time-filter.tsx` (mốc 3 cột + Toàn thời gian / Tùy chỉnh), `invoice-einvoice-state.ts`, `invoice-list-prefs.ts`, `invoice-list-toolbar.tsx`, `invoice-list-table.tsx`, `invoice-csv-export.ts`, `invoice-detail-header.tsx`, `invoice-einvoice-card.tsx`, `invoice-detail-footer.tsx`.
- Viết lại: `invoice-filter-sidebar.tsx`, `invoice-detail-panel.tsx`.
- Sửa nhỏ: `invoice-detail-sections.tsx` (dùng DocCodeLink cho mã hàng và mã phiếu thanh toán, thêm dòng Giảm thuế), `sales-types.ts` (InvoiceListItem + InvoiceState).
- Toolbar: ô "Theo mã hóa đơn" và icon tìm nâng cao (mã hàng, khách hàng, ghi chú); "+ Tạo mới ▾" (Hóa đơn → /pos); "Xuất file ▾" (tổng quan / chi tiết, xuất các dòng đang hiển thị); chọn cột; nút thiết lập → /settings/orders.
- Chi tiết hóa đơn:
  - Đầu: mã KH (link) + ↗ (tab mới), mã HĐ, badge trạng thái, chi nhánh.
  - Hàng thông tin: Người tạo, Người bán (select), Ngày bán (DateTimePicker, khóa khi bật "Không cho phép thay đổi thời gian giao dịch"), Kênh bán (select), Bảng giá.
  - Thẻ "Hoá đơn điện tử" thu gọn được: chip trạng thái, số-ký hiệu kèm link tra cứu MISA, ngày phát hành, người mua, tính chất. Chưa phát hành / lỗi → nút phát hành của `EInvoiceStatus`.
  - Sau đó: vận đơn, dòng hàng, Ghi chú, khối tổng.
  - Chân: Hủy · Sao chép · Xuất file (CSV 1 hóa đơn) | Chỉnh sửa · Lưu · Trả hàng · In · "…" (sửa tỷ lệ thuế).
- Mã chứng từ dùng `DocCodeLink`: mã KH, mã trả hàng, mã hàng, mã phiếu thanh toán, mã đơn đặt hàng. Cột "Mã hóa đơn" giữ chữ thường (bấm dòng để mở).
- Ngoài phạm vi, sửa nhỏ (chỉ thêm, không đổi hành vi cũ):
  - `features/delivery/invoice-shipment-info.tsx`: prop `withMeta` (mặc định true).
  - `features/pos/pos-open-invoice.ts`: thêm `draftCopyOfInvoice()` ở cuối file.

## Kiểm thử
- `npx tsc --noEmit -p .`: không có lỗi trong các file của tôi. Còn 4 lỗi ở `features/pos/pos-cart.tsx` và `pos-screen.tsx`, thuộc phần POS agent đang dựng lại.
- eslint trên mọi file đã sửa / tạo: sạch.
- `scratchpad/e2e_invoice_filters.py`: **15/15 PASS**. Kịch bản: 6 hóa đơn (bán thường, giao đang xử lý, giao thành công, chuyển hoàn, đã hủy, trả hàng). Kiểm tra lọc ids / states / deliveries / returnStates / HĐĐT (chèn và xóa einvoice_records) / tính chất / tìm nâng cao / dòng tổng; Lưu kênh bán (hợp lệ, không tồn tại, giữ nguyên); khóa đổi thời gian giao dịch. Tạo nhóm hàng tạm khi DB trống; dọn dữ liệu còn lại 0 dòng.
- Chưa test trên trình duyệt (không chạy next dev/build).

## Ghi chú cho POS agent
- `/pos?copy=<invoiceId>` (nút Sao chép): cần xử lý trong effect query của `pos-screen.tsx`, giống `edit`/`return`. Gọi `draftCopyOfInvoice(id, catalog.products, me.user.id)` (đã export trong `pos-open-invoice.ts`; cần đợi `catalog.loadedAt`), sau đó `tabs.open(dr)` và `router.replace("/pos")`.
- Link từ POS sang hóa đơn: `/invoices?code=HD…` hoặc `/invoices?id=<uuid>`. Nên dùng `<DocCodeLink code={code} newTab />`.

## Câu hỏi còn mở
- Chưa làm: "Import file" (import hóa đơn từ Excel, cần nghiệp vụ trừ kho riêng), "Mã số thuế người bán", menu "…" và nút trợ giúp ở toolbar, checkbox chọn nhiều dòng (chưa có thao tác hàng loạt).
- Link ↗ khách hàng trỏ `/customers?code=KH…`; trang Khách hàng cần đọc `?code=` thì mới mở đúng khách (theo quy ước DocCodeLink).
- URL tra cứu MISA `https://www.meinvoice.vn/tra-cuu/?sc=<transaction_id>` chưa kiểm chứng với tài khoản thật.
- "CQT chấp nhận" đang dựa vào việc có `inv_code`. Hóa đơn không mã (máy tính tiền) sẽ luôn hiện "Đã phát hành".
- ☆ và cột chỉ lưu trên máy (localStorage). Nếu muốn đồng bộ nhiều máy thì cần bảng user_prefs ở identity-service.
