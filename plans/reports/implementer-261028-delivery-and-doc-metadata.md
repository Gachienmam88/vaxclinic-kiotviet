# Giao hàng (Vận đơn / Quản lý giao hàng / Đối tác giao hàng) + kênh bán, bảng giá, ngày giao: báo cáo triển khai

## Nghiệp vụ đã chọn
- **Không tích hợp API hãng vận chuyển** (GHN/GHTK cần hợp đồng + token). `delivery_partners.partner_type` = `MANUAL` (cập nhật trạng thái tay); thêm giá trị mới (GHN...) + adapter sau mà không đổi schema.
- **Kênh bán**: bảng `sales_channels` (mã PK). Seed: DIRECT "Bán trực tiếp" (builtin: không tắt / xóa được), FACEBOOK, ZALO, WEBSITE, PHONE. Kênh thêm mới: mã `CH001...`. Kênh đã dùng thì không xóa (409), chỉ ngừng hoạt động. Hóa đơn / đơn chỉ nhận kênh đang hoạt động, trừ khi giữ nguyên kênh cũ lúc sửa.
- **Bảng giá trên chứng từ**: `price_book_id` + `price_book_name` (tên lưu lúc bán, không FK chéo DB, server không gọi product-service để kiểm tra). UUID 0 = "Bảng giá chung" trong bộ lọc báo cáo.
- **Vận đơn** = 1 hóa đơn "Bán giao hàng" (`invoices.sale_mode = DELIVERY`), tạo trong cùng transaction với hóa đơn (offline queue đồng bộ cũng tạo vận đơn). Đối tác bắt buộc. Mã `VD000001`.
- **Thu hộ (COD)** = khách cần trả − đã trả (server tính, cập nhật khi sửa hóa đơn trước lúc lấy hàng). Khách lẻ được trả thiếu khi bán giao hàng (phần còn lại là COD).
- **Phí giao hàng**: người trả SHOP (cửa hàng nợ đối tác) / CUSTOMER (người nhận trả thẳng đối tác, cửa hàng không ghi phí). Chuyển hoàn: phí luôn do cửa hàng chịu.
- **Trạng thái**: Chờ xử lý → Đang lấy hàng → Đang giao hàng → Giao thành công | Chuyển hoàn → Đã chuyển hoàn; Đã hủy chỉ từ Chờ xử lý / Đang lấy hàng. Được nhảy bước (VD Chờ xử lý → Giao thành công), không lùi. Mọi lần đổi ghi `shipment_status_logs` (giờ + người + ghi chú) và audit log "Vận đơn".
- **Giao thành công**: COD (≤ phần còn nợ của HĐ) → `invoices.paid += COD` (khách đã trả qua đối tác, KHÔNG tạo phiếu thu vì tiền chưa về quỹ), công nợ khách PAYMENT −COD, sổ đối tác +COD; phí SHOP → sổ đối tác −phí. ⚠ Bất biến cũ "invoices.paid = Σ phân bổ phiếu thu" giờ thành "Σ phân bổ + COD đã giao".
- **Chuyển hoàn / Đã chuyển hoàn (lần đầu)**: tạo phiếu trả hàng qua đường `SalesReturnService` (id suy ra từ vận đơn → idempotent): toàn bộ hàng còn lại về kho, giảm giá HĐ trừ vào giá trị trả, hoàn tiền mặt số khách đã trả trước. Công nợ khách về 0. Sửa nhỏ `SalesReturnService`: khách lẻ chỉ phải hoàn đủ phần đã thu (trước đây đòi hoàn = tổng, đúng với HĐ đã thu đủ nên hành vi cũ không đổi).
- **Đã hủy** = hủy hóa đơn qua `InvoiceService.cancel` (hàng về kho, cần quyền `sales.cancel`). Ngược lại: hủy / sửa hóa đơn bị chặn khi vận đơn đã lấy hàng (`SHIPMENT_IN_PROGRESS`); hủy hóa đơn trước lấy hàng → vận đơn Đã hủy.
- **Sổ công nợ đối tác** (`delivery_partner_ledger`, `delivery_partners.debt`): > 0 = đối tác nợ cửa hàng. Loại: COD, FEE, SETTLEMENT, SETTLEMENT_CANCEL.
- **Đối soát**: chọn vận đơn Giao thành công / Đã chuyển hoàn chưa đối soát (cùng đối tác + chi nhánh) → chênh lệch = Σ COD đã ghi − Σ phí đã ghi → 1 phiếu `PT{DS}` (đối tác trả) hoặc `PC{DS}` (cửa hàng trả) ở Sổ quỹ, nguồn `DELIVERY`, partner_type `DELIVERY_PARTNER`, không hạch toán, không công nợ khách. Mã `DS000001`. **Thanh toán** tự do (thu / chi theo số tiền). Hủy phiếu đối soát: hủy phiếu Sổ quỹ, đảo sổ đối tác, vận đơn chờ đối soát lại. Sổ quỹ chặn hủy tay phiếu nguồn DELIVERY.
- **Báo cáo tài chính "Phí trả ĐTGH"** = Σ phí FEE trên sổ đối tác (ghi nhận lúc giao thành công / chuyển hoàn, theo chi nhánh), cộng vào Chi phí (6). Phiếu đối soát không hạch toán nên không tính 2 lần.
- **Khóa sổ**: đổi trạng thái, đối soát, thanh toán, hủy phiếu đối soát kiểm tra thời điểm hiện tại (hủy: ngày lập phiếu); tạo / sửa / hủy vận đơn đi theo hóa đơn (quy tắc cũ).

## Backend (sales-service)
Migration: `V9__sales_channels_and_doc_metadata.sql` (sales_channels + cột price_book_id/name, sales_channel cho invoices & customer_orders, customer_orders.expected_delivery_at), `V10__delivery.sql` (delivery_partners, shipments, shipment_status_logs, delivery_settlements, delivery_partner_ledger + sequences). Đã chạy (Flyway v10).
Tạo: `channel/SalesChannels.java`, `channel/SalesChannelController.java`; `delivery/` `ShipmentDtos`, `ShipmentStatus`, `ShipmentInvoiceHooks`, `ShipmentStatusService`, `ShipmentStatusWriter`, `ShipmentEditService`, `ShipmentQuery`, `ShipmentController`, `PartnerLedger`, `DeliveryPartnerDtos`, `DeliveryPartnerService`, `DeliveryPartnerQuery`, `DeliveryPartnerController`, `DeliverySettlementService`, `DeliverySettlementController`.
Sửa: `invoice/Invoice.java`, `InvoiceDtos.java` (InvoiceRequest + priceBookId/Name, salesChannel, delivery; InvoiceResponse + priceBook*, salesChannel(Name), shipment), `InvoiceService.java` (209 dòng, vượt nhẹ), `InvoiceWriter.java`, `InvoiceEditWriter.java`, `InvoiceQuery.java`; `order/CustomerOrder.java`, `OrderDtos.java`, `OrderService.java`, `OrderQuery.java`; `salesreturn/SalesReturnService.java` (quy tắc khách lẻ); `cashbook/CashbookService.java` (chặn hủy tay DELIVERY); `report/ReportFilter.java` (priceBookIds, channels, deliveryFrom/To), `SalesSummaryReportController.java` (CHANNEL theo dữ liệu thật), `OrderReportController.java`, `FinanceReportController.java` (deliveryFee). Không đụng `accounting/SellerRevenueInternalController.java`, identity, common-lib, product-service.

### Routes
| Method | Path | Quyền |
|---|---|---|
| GET | /api/sales-channels[?all=true] | sales.perform / report.view / settings.manage |
| POST, PUT /{code}, DELETE /{code} | /api/sales-channels | settings.manage |
| GET | /api/delivery-partners?q&active&debt=OWING\|PAYABLE&page&size | sales.perform / report.view |
| GET | /api/delivery-partners/{id}, /{id}/ledger, /{id}/settlements, /{id}/reconcilable?branchId | như trên |
| POST, PUT /{id}, DELETE /{id} | /api/delivery-partners | sales.perform |
| POST | /api/delivery-partners/{id}/reconcile `{branchId, shipmentIds[], fund, bankAccountId, note}` | sales.perform |
| POST | /api/delivery-partners/{id}/payments `{branchId, direction RECEIPT\|PAYMENT, amount, fund, note}` | sales.perform |
| POST | /api/delivery-partners/settlements/{id}/cancel | sales.perform |
| GET | /api/shipments?q&statuses&partnerId&area&from&to&branchId&reconciled&page&size (+ statusCounts, sumFee, sumCod) | sales.perform / report.view |
| GET, PUT | /api/shipments/{id} (sửa thông tin giao khi chưa lấy hàng) | PUT: sales.perform |
| POST | /api/shipments/status `{ids[], status, note}` → kết quả từng vận đơn | sales.perform (+ sales.cancel cho CANCELLED) |
| — | POST/PUT /api/invoices, /api/orders: thêm trường mới (tương thích ngược, thiếu = DIRECT / không bảng giá) | |
| — | /api/reports/**: thêm `priceBookIds`, `channels`, `deliveryFrom`, `deliveryTo`; /finance trả `deliveryFee` | |

### Gateway
`backend/gateway-service/src/main/resources/application.yml`, route `sales`: thêm `/api/sales-channels/**,/api/delivery-partners/**,/api/shipments/**`. **Chưa restart gateway, lead cần restart.**

## Frontend
Routes mới: `/delivery` (Quản lý giao hàng), `/delivery/shipments` (Vận đơn), `/delivery/partners` (Đối tác giao hàng). Menu lead thêm: Đơn hàng → cột "Giao hàng": Vận đơn `/delivery/shipments`, Quản lý giao hàng `/delivery`, Đối tác giao hàng `/delivery/partners` (perm `sales.perform` hoặc `report.view`).
Tạo:
- `app/(admin)/delivery/page.tsx`, `delivery/shipments/page.tsx`, `delivery/partners/page.tsx`
- `features/delivery/`: `delivery-types.ts`, `delivery-queries.ts`, `use-shipment-status.ts`, `shipment-filter-sidebar.tsx`, `shipment-table.tsx`, `shipment-detail-panel.tsx`, `shipment-edit-dialog.tsx`, `reconcile-dialog.tsx`, `partner-form-dialog.tsx`, `partner-payment-dialog.tsx`, `partner-detail-panel.tsx`, `invoice-shipment-info.tsx`
- `features/pos/`: `use-pos-lookups.ts` (kênh + đối tác, cache máy cho offline), `pos-delivery-form.tsx`
- `features/reports/report-filter-options.ts`; `features/settings/sales-channel-settings.tsx` (Thiết lập → Đơn hàng → Kênh bán)

Sửa: POS `pos-types.ts`, `pos-invoice-body.ts` (body + `deliveryProblem`), `use-pos-tabs.ts` (COD, mặc định khách trả 0 khi giao hàng), `pos-footer.tsx` (Bán giao hàng; ẩn ở tab đặt hàng), `pos-checkout-panel.tsx` (Kênh bán, Thu hộ, Thời gian giao hàng cho đặt hàng), `pos-screen.tsx` (195 dòng), `pos-open-invoice.ts` / `pos-open-order.ts` (sửa giữ kênh, bảng giá, giao hàng, ngày giao), `use-pos-price-book.ts` (lưu tên bảng giá), `pos-price-book-pricing.ts`, `pos-storage.ts`; `sales/sales-types.ts`, `sales/invoice-detail-panel.tsx` (kênh, bảng giá, vận đơn), `sales/cash-voucher-detail.tsx` + `cash-voucher-filter-sidebar.tsx` (nhãn "Đối tác giao hàng", phiếu tự động); `orders/order-types.ts`; reports `sales-report.tsx`, `products-report.tsx`, `party-report.tsx` (Bảng giá / Kênh bán bật, gửi tham số thật), `orders-report.tsx` (Thời gian giao hàng: Hôm nay / Ngày mai / 7 ngày tới / Tháng này / Đã quá hạn), `finance-report.tsx` + `report-api.ts` (Phí trả ĐTGH); `app/(admin)/settings/orders/page.tsx`.

## Kiểm thử
- `mvn -q -o -pl sales-service -am package -DskipTests` OK; sales-service đã restart (:8086), Flyway V9, V10 OK.
- `npx tsc --noEmit -p .` sạch; `npx eslint` mọi file đã sửa / tạo sạch.
- `scratchpad/e2e_delivery.py` (+ `e2e_delivery_kit.py`), gọi thẳng 8081/8082/8086: **29/29 PASS** (cập nhật dòng này theo lần chạy cuối). Gồm: kênh bán CRUD / trùng / builtin / kênh ngừng hoạt động; HĐ + đơn lưu bảng giá, kênh, ngày giao; báo cáo theo kênh, lọc bảng giá (có / Bảng giá chung), kênh, thời gian giao; đối tác CRUD / trùng mã / email; bán giao hàng thiếu thông tin / đối tác ngừng; khách lẻ COD; sửa HĐ cập nhật COD; lọc khu vực + đếm trạng thái; chặn lùi trạng thái, chặn hủy / sửa HĐ đang giao; lịch sử trạng thái; giao thành công (HĐ đủ tiền, sổ COD + FEE, nợ khách); người nhận trả phí; chuyển hoàn (phiếu trả, kho về, hoàn tiền trả trước, không tạo phiếu 2 lần, phí chuyển hoàn); khách lẻ chuyển hoàn không hoàn tiền; hủy hàng loạt (HĐ hủy, kho về, lỗi riêng từng vận đơn); đối soát → PT{DS} 620k; đối soát lại 400; Sổ quỹ chặn hủy tay; hủy phiếu đối soát; chi trả đối tác PC{DS}; tổng danh sách đối tác; xóa đối tác đã dùng 409; Phí trả ĐTGH +50k; khóa sổ chặn đổi trạng thái + thanh toán. Tự dọn dữ liệu (còn lại 0 dòng).
- Hồi quy: `e2e_reports.py` **34/34** (mở rộng E12 + E26–E28: nhóm kênh Zalo, lọc kênh / bảng giá, cột deliveryFee); `e2e_orders_groups.py` **32/32**.
- Chưa test trên trình duyệt (không chạy next dev/build theo yêu cầu).

## Câu hỏi còn mở
- Hủy vận đơn = hủy hóa đơn (như KiotViet?). Có cần cho "hủy vận đơn, giữ hóa đơn" (chuyển sang bán thường, khách lẻ phải trả đủ) không?
- Chuyển hoàn hoàn tiền trả trước bằng tiền mặt ngay. Có muốn giữ làm công nợ (khách có tài khoản) hoặc chọn phương thức hoàn không?
- Phí chuyển hoàn luôn do cửa hàng chịu, kể cả khi đã chọn "người nhận trả". Có đúng hợp đồng đối tác của cửa hàng không?
- COD giao thành công tăng `invoices.paid` mà không có phiếu thu, nên tab "Lịch sử thanh toán" của HĐ chưa hiện dòng thu hộ (thông tin vận đơn có hiện). Có cần thêm dòng ảo "Thu hộ qua ĐTGH" không?
- Bảng giá lưu theo id + tên client gửi, server không kiểm tra với product-service. Có chấp nhận được không?
- Sửa HĐ giao hàng sang chế độ khác không hủy vận đơn (vận đơn giữ nguyên, COD tính lại). Có cần hủy tự động không?
- Báo cáo đặt hàng mới bật lọc "Thời gian giao hàng"; Bảng giá / Kênh bán cho báo cáo đặt hàng mới có ở API (`priceBookIds`, `channels`), sidebar chưa có ô chọn.
