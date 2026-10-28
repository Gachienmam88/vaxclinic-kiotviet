# Implementer report: Danh mục ĐVHC 2 cấp (sau 01/07/2025) trong mọi form địa chỉ

**Status:** DONE_WITH_CONCERNS
**Summary:** Đã thêm dataset tĩnh (34 tỉnh/thành, 3.321 phường/xã/đặc khu, khớp 100% mã với API chính thức của Cục Thống kê) và component dùng chung Khu vực → Phường/Xã (tìm không dấu). Đã áp dụng cho NCC, khách hàng (địa chỉ chính + địa chỉ xuất HĐ), cửa hàng, chi nhánh, địa điểm thuế, đối tác giao hàng, POS "Bán giao hàng", tạo/sửa vận đơn và bộ lọc khu vực /delivery. Backend lưu mã (chỉ kiểm tra định dạng) cạnh cột tên. Hóa đơn in có địa chỉ khách.

## Data source + counts
- Dataset: thanglequoc/vietnamese-provinces-database v5.2.0 (`json/full_json_generated_data_vn_units.json`, LatestDecree 388/NQ-UBTVQH16, generated 2026-09-20). Được tạo từ API của GSO/NSO.
  https://github.com/thanglequoc/vietnamese-provinces-database (lấy ngày 2026-10-29)
- Đối chiếu chính thức: SOAP `DanhMucPhuongXa` tại https://danhmuchanhchinh.nso.gov.vn/DMDVHC.asmx, DenNgay=29/10/2026 (lấy ngày 2026-10-29). Trang https://danhmuchanhchinh.nso.gov.vn/ cũng hiện "Số lượng: 34" tỉnh.
- Kết quả: **34 tỉnh/thành** (25 tỉnh, 9 thành phố); **3.321 đơn vị cấp xã** = 2.599 xã + 709 phường + 13 đặc khu. Không có mã trùng, mọi phường/xã đều trỏ tới một mã tỉnh hợp lệ.
- So với GSO: cùng 3.321 mã, không thiếu/thừa mã nào, 0 lệch tỉnh. Có 226 khác biệt về tên, tất cả chỉ là kiểu chữ: khoảng trắng/xuống dòng thừa ở phía GSO, vị trí dấu thanh (Hoà/Hòa), Unicode NFC. Còn 7 tên khác nhau ở dấu nháy (`'` so với `’`, ví dụ Xã Ea H'Leo). Giữ tên theo dataset (NFC, gọn).
- **Chênh lệch cần biết:** tổng 3.321 khớp, nhưng cơ cấu hiện tại là 709 phường / 2.599 xã. Con số thường được trích dẫn khi bắt đầu áp dụng 01/07/2025 là 687 / 2.621. Phần chênh 22 đơn vị đến từ các NQ năm 2026 (30, 36, 39/2026/QH16; 237, 388/NQ-UBTVQH16), và chính GSO cũng ra đúng các số này. Tôi giữ nguyên số liệu, không ép về số cũ.
- Script build/đối chiếu (ngoài thư mục raw): `scratchpad/vn-admin-scripts/build_vn_admin.py`, `compare_gso.py`. File raw ở `scratchpad/vn-admin-raw/`.
- File: `frontend/public/data/vn-admin-2025.json`, 260.633 B (32,9 KB gzip). Có `_meta` gồm nguồn, căn cứ pháp lý, ngày lấy, số lượng, vì JSON không cho viết comment. Một file là đủ, không cần tách theo tỉnh.

## Frontend
- `src/lib/vn-admin-search.ts`: hàm thuần (bỏ dấu, `searchUnits` ưu tiên khớp đầu tên, khớp cả mã, `joinAddress`, kiểm tra định dạng mã).
- `src/lib/vn-admin-data.ts`: `loadVnAdmin()` (promise lưu trong bộ nhớ, có index theo tỉnh) và hook `useVnAdmin()`.
- `src/components/ui/searchable-select.tsx`: ô chọn có tìm kiếm, dùng phím ↑↓ Enter Esc, có nút bỏ chọn, hiện tên đã lưu khi không có mã.
- `src/components/ui/vn-address-fields.tsx`: `VnAddressFields`, `VnAddress {address, provinceCode, provinceName, wardCode, wardName}`, `toVnAddress`. Đổi tỉnh thì xóa phường. Có `renderRow` để khớp từng bố cục form.
- `src/features/delivery/delivery-address.ts`: ánh xạ thông tin giao hàng. `area` = "Phường/Xã, Tỉnh/Thành phố" (vẫn là cột tên cũ), kèm mã. Vận đơn cũ hiện `area` làm tên khu vực.
- Offline: `public/sw.js` cache trước `/data/vn-admin-2025.json` và phục vụ `/data/**` theo stale-while-revalidate. `pos-screen.tsx` tải sẵn vào bộ nhớ. `middleware.ts` bỏ qua `/data/`.
- Các form đã áp dụng:
  - `features/purchases/supplier-form-dialog.tsx`
  - `features/sales/customer-form-fields.tsx` (cả 2 địa chỉ)
  - `app/(admin)/settings/store/page.tsx`
  - `features/settings/branch-form-dialog.tsx` và `settings/branches/page.tsx` (cột địa chỉ ghép)
  - `features/accounting/tax-location-dialog.tsx`
  - `features/delivery/partner-form-dialog.tsx` và `partner-detail-panel.tsx`
  - `features/delivery/shipment-delivery-fields.tsx`, `shipment-create-dialog.tsx`, `shipment-edit-dialog.tsx`
  - `features/pos/pos-delivery-form.tsx`, `pos-types.ts`, `pos-invoice-body.ts`, `pos-open-invoice.ts`
  - `features/delivery/shipment-filter-sidebar.tsx`: chọn tỉnh, gửi `provinceCode` cùng tên rút gọn để khớp vận đơn cũ.
- Types đã cập nhật: purchase-types, sales-types (`customerAddress` + các mã), settings-queries (Branch, StoreInfo), tax-queries, delivery-types.
- In: `print-data.ts` thêm `Dia_Chi_Khach_Hang` (ghép "address, ward, province" phía server) và `Dia_Chi_Giao_Hang`. Mẫu HĐ mặc định có thêm dòng "Địa chỉ". `print-template-defaults.ts` đã khai báo trường mới.
- HR: không có form/cột địa chỉ nên không áp dụng.

## Backend (mã: varchar, chỉ kiểm tra định dạng `([0-9]{2})?` / `([0-9]{5})?`, chuỗi rỗng → NULL)
- common-lib: `common/address/AdminUnitCodes.java` (regex, thông báo lỗi, `clean`, `joinAddress`).
- product-service V7 `suppliers.province_code, ward_code`: Supplier, SupplierRequest, SupplierRow. Khi import: nếu file có cột khu vực thì bỏ mã cũ, không có cột thì giữ mã cũ.
- sales-service V12:
  - customers: `province_code, ward_code, invoice_province_code, invoice_ward_code`
  - shipments: `province_code, ward_code` + index
  - delivery_partners: `province, ward, province_code, ward_code`
  - DTO đã sửa: CustomerRequest/Response, DeliveryInput, ShipmentInfo, ShipmentListItem, UpdateRequest, PartnerRequest/Row (gộp RowMapper dùng chung).
  - `GET /api/shipments?provinceCode=` lọc theo mã. Vận đơn chưa có mã thì khớp theo `area` khi có kèm tham số area.
  - `InvoiceResponse.customerAddress`.
- identity-service V6 `branches.province, ward, province_code, ward_code`: Branch, BranchRequest/Response. StoreInfo (JSON) và TaxSettings Location (JSON) thêm `provinceCode, wardCode`.
- Bản ghi cũ không có mã vẫn hiện tên như trước.

## Tests
- `frontend/tests/vn-admin-data.test.mjs` (chạy bằng `node --experimental-strip-types --test tests/vn-admin-data.test.mjs`): 6/6 pass. Kiểm tra số lượng, định dạng/trùng mã, tham chiếu tỉnh, đối chiếu một số mã GSO, bỏ dấu, tìm kiếm, ghép địa chỉ.
- Kết quả e2e (scratchpad):
  - `e2e_suppliers.py`: 59/59, thêm V1–V5 (round-trip mã, đổi tỉnh, mã rỗng → null, mã sai → 400, NCC cũ chỉ có tên).
  - `e2e_delivery.py`: 37/37, thêm V1–V5 (mã của đối tác, vận đơn từ HĐ, lọc theo tỉnh, khớp vận đơn cũ theo tên, sửa vận đơn, mã sai → 400).
  - `e2e_settings.py`: 31/31, thêm V1–V3 (cửa hàng, chi nhánh, khách hàng gồm cả mã địa chỉ xuất HĐ).
- Đã sửa thêm để các test chạy được trên DB trống: tạo nhóm hàng tạm khi chưa có (ở `e2e_suppliers.py` và `e2e_delivery_kit.py`), xóa hẳn hàng/nhóm test. `e2e_settings.py` trước đây không dọn dữ liệu: đã thêm cleanup qua atexit và xóa phần dữ liệu còn lại của lần chạy đầu. Sau các lần chạy, đã kiểm tra DB: 0 categories/products/suppliers/invoices/customers/vouchers.
- Đã chạy `npx tsc --noEmit -p .` (sạch) và eslint các file đã sửa (0 lỗi, 1 cảnh báo `<img>` có từ trước ở store page).
- Đã build tuần tự product, sales (2 lần), identity. Migration V7/V12/V6 chạy thành công, cả 3 service khởi động bình thường.

## Concerns / unresolved
1. integration-service không khởi động: thiếu `ENCRYPTION_KEY` trong env (lỗi có từ trước, tôi không sửa gì ở đây). start-all cứ khởi động lại rồi nó lại chết.
2. Lần build sales thứ hai: 8086 đã down từ trước, và mọi service lẫn frontend đều đã dừng. start-all đã bật lại tất cả, kể cả frontend :3010 bản build cũ. Lead cần build frontend để có UI mới, `sw.js` mới và middleware mới.
3. Khi lưu, tên khu vực lấy theo dataset. Nếu sau này dataset đổi tên, bản ghi cũ vẫn giữ tên đã lưu. Muốn cập nhật thì thay file JSON và chạy lại `build_vn_admin.py`.
4. Bố cục form vận đơn (lưới 2 cột) giờ dư một ô trống cạnh "Phí giao hàng". Đây là chuyện thẩm mỹ.
5. `e2e_settings.py` ghi đè thông tin cửa hàng thành "VẮC XIN SỐ 1 YÊN LẠC / Phú Thọ" (hành vi có từ trước). Cleanup trả lại giá trị đọc được lúc bắt đầu chạy.
