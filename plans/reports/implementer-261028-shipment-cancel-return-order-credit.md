# Hủy vận đơn ≠ hủy HĐ, Chuyển hoàn / Đã chuyển hoàn, hủy đơn giữ cọc: báo cáo triển khai

## Nghiệp vụ
1. **Hủy vận đơn** (chỉ Chờ xử lý / Đang lấy hàng, quyền `sales.perform`, bỏ yêu cầu `sales.cancel`): chỉ vận đơn → Đã hủy, `cod_amount = 0`. HĐ vẫn Hoàn thành, kho không đổi, khách vẫn nợ phần chưa trả (sổ nợ không đụng). Hủy HĐ vẫn hủy vận đơn đang hoạt động chưa lấy hàng; vẫn bị chặn khi vận đơn đang hoạt động đã lấy hàng.
   - 1 HĐ có thể có nhiều vận đơn, **tối đa 1 vận đơn chưa hủy** (V11: bỏ UNIQUE(invoice_id), thêm partial unique index `ux_shipments_active_invoice ... WHERE status <> 'CANCELLED'`). Mọi thao tác theo HĐ (chặn sửa / hủy, sửa HĐ cập nhật COD, hủy HĐ) chỉ nhìn vận đơn đang hoạt động.
   - `InvoiceResponse.shipment` = vận đơn đang hoạt động, không có thì lấy vận đơn đã hủy gần nhất.
   - **Tạo vận đơn**: `POST /api/shipments {invoiceId, delivery}` (sales.perform, 201 → ShipmentDetail). Điều kiện: HĐ Hoàn thành, không có vận đơn đang hoạt động (`SHIPMENT_EXISTS`), không có phiếu trả (`INVOICE_HAS_RETURNS`), đối tác đang hoạt động, khóa sổ tính theo hiện tại. Khóa dòng HĐ, COD = tổng − đã trả, đặt `sale_mode = DELIVERY`, audit "Vận đơn / Tạo".
2. **Chuyển hoàn** = chỉ đổi trạng thái: không phiếu trả, không nhập kho, không ghi phí. **Đã chuyển hoàn** (lần đầu) mới tạo phiếu trả (hàng về kho) + ghi phí. API `POST /api/shipments/status` thêm `refundMethod` (`CASH|TRANSFER|CREDIT`, **bắt buộc** khi chuyển sang RETURNED, kể cả hàng loạt), `bankAccountId` (TRANSFER), `shippingFee`, `returnFee`.
   - CASH / TRANSFER: phiếu chi hoàn số khách đã trả (TRANSFER → quỹ BANK + tài khoản). CREDIT: hoàn 0 → không có phiếu chi, nợ khách giảm theo giá trị trả (âm = tiền trả trước). Khách lẻ + CREDIT → `WALK_IN_CREDIT`.
   - Phí: phí giao hàng (mặc định = phí của vận đơn, **kể cả khi người nhận trả**) + phí chuyển hoàn (mặc định 0). Mỗi khoản 1 dòng FEE trên sổ đối tác → tính vào "Phí trả ĐTGH". `fee_posted` = tổng 2 khoản, cột mới `return_fee`. Nhập phí khi cập nhật hàng loạt >1 vận đơn → 400 `FEE_PER_SHIPMENT`.
   - Vận đơn theo luồng cũ (đã có phiếu trả / đã ghi phí lúc Chuyển hoàn) → Đã chuyển hoàn không tạo / ghi lại.
3. **Hủy đơn đặt hàng có cọc**: `POST /api/orders/{id}/cancel?refundMethod=CASH|TRANSFER|CARD|EWALLET|CREDIT&bankAccountId=`. Hình thức sai → 400 `REFUND_METHOD_INVALID`. CREDIT: không phiếu chi, phiếu thu cọc vẫn hiệu lực, `customer_orders.deposit` giữ nguyên (đơn đã hủy mà còn deposit > 0 = cọc giữ làm công nợ), nợ khách vẫn âm. TRANSFER đặt bankAccountId cho phiếu chi PC{DH}. Audit ghi đúng cách xử lý.
- Giữ khóa sổ, audit, quyền. InvoiceService không đổi (209 dòng); ShipmentStatusService bỏ phụ thuộc InvoiceService.

## Backend (sales-service)
- Mới: `db/migration/V11__shipment_cancel_and_return_fees.sql` (đã chạy, Flyway v11), `delivery/ShipmentReturnService.java` (tách phần tạo phiếu trả + kiểm tra refund), `delivery/ShipmentCreateService.java`.
- Sửa: `delivery/ShipmentStatusService.java`, `ShipmentStatusWriter.java`, `ShipmentInvoiceHooks.java` (lọc vận đơn đang hoạt động, `markCancelled`, `createForInvoice` trả id, `statusOf` public), `ShipmentController.java` (POST tạo, bỏ check sales.cancel), `ShipmentDtos.java` (StatusRequest + ReturnOptions + CreateRequest; ShipmentDetail + feePosted, returnFee), `ShipmentQuery.java`; `salesreturn/SalesReturnDtos.java` (ReturnRequest + `bankAccountId` tùy chọn, tương thích ngược JSON), `SalesReturnWriter.java` (gán tài khoản cho phiếu chi); `order/OrderController.java`, `OrderService.java`, `OrderDepositLedger.java`.
- Build `mvn -q -o -pl sales-service -am package -DskipTests` OK; đã restart sales-service :8086 (health 200).

## Frontend
- Mới: `features/sales/refund-method-fields.tsx` (radio Tiền mặt / Chuyển khoản + tài khoản / Giữ làm công nợ), `features/delivery/shipment-returned-dialog.tsx` (1 vận đơn: cách hoàn + phí giao + phí chuyển hoàn; hàng loạt: chỉ cách hoàn), `features/delivery/shipment-delivery-fields.tsx` (ô nhập giao hàng dùng chung), `features/delivery/shipment-create-dialog.tsx`, `features/orders/order-cancel-dialog.tsx`.
- Sửa: `delivery/use-shipment-status.ts` (opts, câu xác nhận mới), `delivery/shipment-detail-panel.tsx` (Hủy không cần sales.cancel, Đã chuyển hoàn mở dialog, dòng "Phí cửa hàng chịu"), `app/(admin)/delivery/page.tsx` (hàng loạt Đã chuyển hoàn mở dialog), `delivery/shipment-edit-dialog.tsx` (dùng fields chung), `delivery/invoice-shipment-info.tsx` ("Chưa giao" + nút **Tạo vận đơn**), `delivery/delivery-types.ts`, `delivery/delivery-queries.ts` (làm mới cả products), `orders/order-detail-panel.tsx` (dialog hủy, nhãn "Cọc … giữ làm công nợ"), `pos/pos-open-invoice.ts` (sửa HĐ không nạp lại vận đơn đã hủy).
- `npx tsc --noEmit -p .` sạch; `npx eslint` các file đã sửa / tạo sạch.

## Kiểm thử
- Đã cập nhật script trong scratchpad: `e2e_delivery.py` + `e2e_delivery_kit.py` (D8–D13 mới: Chuyển hoàn không nhập kho; Đã chuyển hoàn thiếu refundMethod lỗi, CREDIT không phiếu chi / nợ âm / phí 20k+15k; khách lẻ CREDIT bị chặn; hàng loạt TRANSFER + chặn phí hàng loạt; hủy vận đơn giữ HĐ / nợ; Tạo vận đơn với đối tác khác, chặn trùng; hủy HĐ hủy vận đơn mới; R1–R6, F1 tính lại), `e2e_orders_groups.py` (O21c giữ cọc, O21d hoàn chuyển khoản; khối khóa sổ O22 bọc try/finally để luôn trả thiết lập). Branch lấy từ env `E2E_BRANCH` (mặc định CN001) trong 4 script.
- **CHƯA chạy được e2e**: thiết lập khóa sổ đang **bật đến 2026-10-28 cho CN001** (audit identity: "Khóa sổ: Bật" lúc 14:16:48 UTC, không có lần tắt sau đó, có vẻ test cũ bị dừng giữa chừng khi restart service). Mọi thao tác tạo HĐ / đơn trả về BOOK_LOCKED. Mình định trả lại thiết lập (Tắt) nhưng auto-mode chặn vì sửa tài nguyên dùng chung; CN002 thì admin không được gán. Lần chạy duy nhất (bị khóa) đã tự dọn dữ liệu (còn 0 dòng).
- Cần lead / user: tắt khóa sổ (Thiết lập → Khóa sổ, hoặc PUT /api/settings/lock với enabled=false), đợi khoảng 30 giây cho hết cache, rồi chạy:
  `python -I -X utf8 <scratchpad>/e2e_delivery.py C:/Users/chipc/Desktop/kiot_viet_clone`, tương tự `e2e_orders_groups.py`, `e2e_reports.py`, `e2e_sales.py`.

## Câu hỏi còn mở
- Tiền khách trả trước (công nợ âm từ CREDIT) chỉ bù trừ trong số dư công nợ; HĐ mới không tự tăng "đã trả" (chưa có cơ chế phân bổ phần dư phiếu thu cọc / trả hàng vào HĐ sau). Có cần thêm không?
- Hủy vận đơn của khách lẻ còn COD: HĐ khách lẻ còn nợ mà không có sổ nợ. Hiện vẫn cho hủy; cách xử lý là tạo vận đơn mới hoặc hủy HĐ. Có muốn chặn không?
- Tạo vận đơn cho HĐ bán thường (không phải bán giao hàng): API cho phép (đổi sale_mode sang DELIVERY), UI chỉ hiện nút cho HĐ bán giao hàng.
