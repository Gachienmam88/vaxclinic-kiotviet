# Nhóm khách hàng + Đặt hàng (DH) — báo cáo triển khai

## Nghiệp vụ đã chọn
- **Nhóm khách hàng**: bảng `customer_groups` (tên duy nhất không phân biệt hoa thường, giảm giá PERCENT ≤100 | AMOUNT, ghi chú). `customers.group_id` FK; giữ `group_name` làm bản sao tên (đổi tên nhóm → cập nhật khách) để API cũ chạy. V6 chuyển `group_name` gõ tay cũ thành nhóm (gộp hoa thường/khoảng trắng).
- API khách tương thích ngược: request nhận `groupId` (mới) hoặc `groupName` (cũ → tìm nhóm theo tên, không có → 400 GROUP_NOT_FOUND); response trả cả `groupId` + `groupName`. `/api/customers/groups` (danh sách tên) vẫn còn.
- **Xóa nhóm = bỏ nhóm cho khách** (như KiotViet), không chặn; UI confirm báo số khách bị ảnh hưởng.
- POS: danh sách khách (`/customers` list item) mang `groupDiscountType/Value` → lưu vào cache khách trên máy → offline vẫn tự điền giảm giá. % tính lại theo giỏ; sửa tay → về số tiền; bỏ chọn khách khi đang giảm % → bỏ giảm.
- **Đặt hàng**: không trừ kho. Cọc = phiếu thu `TT{DH}` (lần sau `TT{DH}-n`), nguồn `ORDER`, không hạch toán doanh thu, sổ nợ PAYMENT (khách trả trước → nợ âm). Phiếu cọc không hủy tay được ở Sổ quỹ.
- **Tạo hóa đơn**: đường bán thường (`POST /api/invoices` với `orderId`, hoặc `POST /api/orders/{id}/invoice`): kiểm tra đơn còn mở + cùng khách + cùng chi nhánh TRƯỚC khi xuất kho; trong transaction ghi HĐ: phân bổ phiếu cọc vào HĐ (paid tăng, không ghi sổ nợ lần 2), đơn → COMPLETED, `invoices.order_id`. Khách trả thêm tối đa phần còn lại.
- **Hủy HĐ tạo từ đơn**: gỡ phân bổ cọc, đơn mở lại "Đã xác nhận", cọc vẫn thuộc đơn (nợ khách = −cọc).
- **Hủy đơn có cọc: hoàn tiền bằng phiếu chi `PC{DH}`** lập lúc hủy (sổ nợ REFUND) — đơn giản & đúng kế toán (không sửa phiếu kỳ cũ). Không chọn "giữ làm công nợ" để tránh tiền treo không gắn chứng từ.
- Sửa đơn: đã có cọc thì không đổi khách; tổng không < đã trả. Đơn COMPLETED/CANCELLED không sửa/hủy/tạo HĐ.
- Khóa sổ: tạo/hủy đơn kiểm tra thời điểm hiện tại (phiếu thu/chi phát sinh lúc đó), sửa/xác nhận kiểm tra ngày đặt; HĐ từ đơn kiểm tra như HĐ thường. Thiết lập Đơn hàng: không có toggle riêng cho đặt hàng; tồn kho âm/lô áp dụng khi tạo HĐ (product-service).
- In đơn đặt hàng: **bỏ qua** — thêm loại mẫu in cần sửa whitelist `PrintTemplateController.TYPES` ở identity-service (ngoài phạm vi).

## Backend (sales-service)
Tạo: `db/migration/V6__customer_groups.sql`, `V7__customer_orders.sql`; `customer/CustomerGroup{,Repository,Service,Controller}.java`; `order/CustomerOrder.java`, `CustomerOrderLine.java`, `CustomerOrderRepository.java`, `OrderDtos.java`, `OrderService.java`, `OrderDepositLedger.java`, `OrderQuery.java`, `OrderController.java`.
Sửa: `customer/Customer.java`, `CustomerDtos.java`, `CustomerService.java`, `CustomerListQuery.java`, `CustomerController.java`, `CustomerRepository.java`; `invoice/Invoice.java` (orderId), `InvoiceDtos.java` (InvoiceRequest.orderId + withOrderId, InvoiceResponse.orderId/orderCode), `InvoiceService.java`, `InvoiceWriter.java`, `InvoiceQuery.java`; `cashbook/CashbookService.java` (chặn hủy tay phiếu ORDER).
Endpoints: `GET/POST /api/customer-groups`, `PUT/DELETE /api/customer-groups/{id}`; `GET /api/orders` (q, statuses, from, to, createdBy, customerId, branchId, page, size), `GET/PUT /api/orders/{id}`, `POST /api/orders`, `POST /api/orders/{id}/confirm`, `POST /api/orders/{id}/cancel?refundMethod=`, `POST /api/orders/{id}/invoice`. Audit log cho mọi thao tác ghi.
Gateway (`gateway-service/.../application.yml`, route `sales`): thêm `/api/customer-groups/**,/api/orders/**` — chưa restart gateway.

## Frontend
Routes mới: `/orders`, `/customers/groups` (chưa thêm menu — lead thêm).
Tạo: `app/(admin)/orders/page.tsx`, `app/(admin)/customers/groups/page.tsx`, `features/orders/{order-types.ts,order-queries.ts,order-filter-sidebar.tsx,order-detail-panel.tsx,order-detail-sections.tsx}`, `features/sales/{customer-group-dialog.tsx,customer-group-discount.ts}`, `features/pos/{pos-open-order.ts,use-pos-order-submit.ts}`.
Sửa: `features/pos/{pos-types.ts,use-pos-tabs.ts,pos-invoice-tabs.tsx,pos-checkout-panel.tsx,pos-customer-picker.tsx,pos-invoice-body.ts,pos-open-invoice.ts,pos-screen.tsx}`, `features/sales/{sales-types.ts,sales-queries.ts,customer-form-fields.tsx,customer-form-dialog.tsx,customer-list-filter-sidebar.tsx,invoice-detail-sections.tsx,invoice-detail-panel.tsx}`, `app/(admin)/customers/page.tsx`.
POS: nút "Thêm đặt hàng" (icon bảng kê) cạnh (+) trên thanh tab → tab "Đặt hàng N": "Khách thanh toán" = cọc (mặc định 0), nút ĐẶT HÀNG / LƯU ĐƠN; cần mạng (mất mạng → toast lỗi, giữ giỏ). `/pos?order=<id>` sửa đơn, `/pos?orderInvoice=<id>` tạo HĐ (dòng "Đã đặt cọc", khách cần trả trừ cọc; mất mạng → toast lỗi, không xếp hàng offline).

## Kiểm thử
- `mvn -q -o -pl sales-service -am package -DskipTests` OK; sales-service đã restart (8086), Flyway V6, V7 thành công.
- `npx tsc --noEmit -p .` sạch; `npx eslint` các file đã sửa sạch.
- `scratchpad/e2e_orders_groups.py` (gọi thẳng 8086/8081/8082 bằng JWT): **31/31 PASS** — CRUD nhóm, trùng tên, migration V6 (chạy lại trong transaction ROLLBACK), groupName cũ, giảm giá nhóm trong list; đơn tạo/gửi lại/xác nhận/sửa/cọc 2 lần/chặn đổi khách & giảm tổng; chặn hủy tay phiếu cọc; tạo HĐ (trừ kho, cọc phân bổ, công nợ đúng), chặn khác khách; hủy HĐ mở lại đơn; hủy đơn hoàn cọc PC; khóa sổ chặn tạo/sửa/hủy. Tự dọn dữ liệu (atexit).
- Hồi quy qua BFF :3010 (frontend cũ → gateway → sales mới): `e2e_sales.py` 22/22, `e2e_edit_return.py` 18/18.

## Câu hỏi còn mở
- Có cần cho chọn "giữ cọc làm công nợ" khi hủy đơn (thay vì luôn hoàn PC) không?
- Có cần mẫu in Đặt hàng (sửa whitelist mẫu in ở identity-service)?
- Hai HĐ tạo đồng thời từ cùng 1 đơn: HĐ thứ 2 bị chặn ở bước ghi DB nhưng kho đã trừ (cùng giới hạn với luồng bán hiện có) — chấp nhận được?
