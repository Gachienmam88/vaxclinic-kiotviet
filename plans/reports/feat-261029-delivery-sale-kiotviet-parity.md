# feat-261029 — Bán giao hàng: KiotViet parity

Date: 2026-10-29 · Branch: feature/phase-01-foundation

## Backend (sales-service)
- `V16__delivery_sale_kiotviet_parity.sql`: table `delivery_partner_groups` (unique lower(name)); `delivery_partners.partner_kind` (PERSONAL/COMPANY), `group_id` (FK, on delete set null); `shipments.service_type` (STANDARD/EXPRESS), `waybill_code`, `expected_delivery_at`, `package_count`, `length_cm/width_cm/height_cm`, `cod_enabled`; index on `receiver_phone`.
- Partner: `PartnerRequest` + `partnerKind`, `groupId` (validated → 400 PARTNER_GROUP_NOT_FOUND); `PartnerRow` + `partnerKind/groupId/groupName`. Code still auto `DT000001`.
- Groups: `GET/POST /api/delivery-partners/groups` (under existing gateway route; dup → 409 PARTNER_GROUP_DUPLICATE). `DeliveryPartnerGroup{Controller,Service,Repository}`.
- `DeliveryInput` + serviceType, waybillCode, expectedDeliveryAt, packageCount, L/W/H, codEnabled, status (PENDING|PICKING|DELIVERING|DELIVERED). `ShipmentInfo` (invoice detail) returns them + createdAt.
- COD toggle: off → cod_amount 0, unpaid part = customer debt; walk-in + COD off + unpaid → WALK_IN_DEBT (create + edit guard). `updateCod` respects stored `cod_enabled`.
- Initial status: `ShipmentInitialStatus` (called from `InvoiceManageService` after the invoice commit) moves the new shipment via `ShipmentStatusService` (same ledger/debt postings as manual update). Failure (e.g. book lock) → stays PENDING, logged.
- `GET /api/shipments/receiver-stats?phone=` → {finished, delivered, rate} (DELIVERED / (DELIVERED+RETURNED)).
- Build `mvn -q -pl sales-service -am package` OK (tests pass).

## Frontend
- Sale screen DELIVERY mode now a 3-column layout (`sale-delivery-layout.tsx`): left = cart + totals card (Ghi chú đơn hàng, Tổng tiền hàng, Giảm giá, Khách cần trả, Thông tin xuất HĐĐT · Chi tiết); »/« handle collapses middle; middle = seller · channel · date, customer chip (blue), pickup row (portal tab only; branch address/phone, red hint when branch has no address), receiver (green pin, name, phone, orange success-rate badge when data, + new receiver), address/Khu vực/Phường-Xã, package (n kiện + pencil, weight gram/kg, L×W×H cm), Ghi chú cho bưu tá, Khách thanh toán (QR) + Thu hộ tiền (COD) switch; right = tabs Cổng KiotViet / Tự giao hàng + THANH TOÁN (F9).
- Tự giao hàng (default tab): Đối tác (select + ✎ edit + + add), then Loại dịch vụ, Phí áp dụng, Mã vận đơn, Thời gian giao hàng, Trạng thái giao hàng (default Chờ xử lý; disabled when editing an invoice).
- Cổng KiotViet tab: light-blue hint + disabled gear + explicit "no portal connected" note + button to switch to Tự giao hàng. No carriers/quotes/banners.
- Partner modal rebuilt like 205 (Cá nhân/Công ty, Mã mặc định, Tên*, ĐT, Email, Địa chỉ chi tiết, Khu vực, Phường/Xã, Nhóm đối tác with inline "+" create group, Ghi chú; status only when editing). Used by sale + partners page; `onSaved` selects new partner in sale and updates offline lookups.
- Print: `features/print/delivery-invoice-print-template.ts` (layout of 206, shop logo/name/address/hotline/MST from store settings, receiver boxes, TT|Tên Hàng|SL|Đơn giá|Thành tiền, Cộng, Tổng Cộng, date + NGƯỜI BÁN HÀNG, thanks). Rendered via renderTemplate → printHtml (sanitizeHtml). Delivery invoices print automatically after payment (other modes still follow autoPrint).
- Invoice detail: collapsible bar "🧺 Tự giao đến <address>" (partner, service, fee, waybill, time, status, receiver, COD, package, note, VĐ link) + new tab "Lịch sử giao hàng" (status logs).
- `VnAddressFields` gained optional `selectPlaceholders`; `SaleEInvoiceBox` `plain`; `SaleCustomerPicker` `nameClassName`. Old `sale-delivery-form.tsx` removed.
- i18n vi/en/zh/ja: sale `delivery.*`, delivery `selfShip.*`, sales `invoices.detail.tabDelivery`.
- `tsc --noEmit` clean; eslint clean on changed files; no vitest tests exist for these files.

## Verification
- e2e_delivery.py: 43/43 pass (new `e2e_delivery_selfship.py`: G1–G3 groups/kind, T1 self-delivery fields + initial status DELIVERING, T2 COD off + walk-in guard, T3 receiver success rate). Cleanup also deletes test groups; 0 rows left.
- All services healthy (8081/8082/8086/8088/8090, :3010 200). Frontend :3010 is `next start` (production, not dev). Working-tree `next build` currently FAILS on another agent's in-progress invoice import/export/columns work (missing `invoices.columns.*`/`exportColumns.*`/`jobs.*` keys, `onImport/onMerge` props, `StoreProfile.taxCode`) — not this task's files. To keep :3010 up, bundle was built in a temp worktree at b44ead2 + this task's 707fbb0 fixes and copied into frontend/.next, then restarted. Once the invoices agent finishes, rebuild normally.
- Playwright screenshots of the delivery sale screen (self tab, portal tab, partner modal) checked: no page errors.

## Not implemented (no backend → no fake UI)
- "Bán thuốc theo đơn" checkbox, "Giảm thuế" toggle in sale screen.
- Branch select in middle header (sale screen uses the user's first branch; existing seller picker kept).
- Delivery print template is not editable in Settings → Mẫu in (would need identity-service TYPES change + rebuild).

## Unresolved questions
- Should delivery invoices always auto-print after payment, or follow the "Tự động in" setting?
- Loại dịch vụ list: only Giao thường / Giao nhanh — confirm KiotViet's full list.

---

## Follow-up 1 (2026-10-29): user requests
- Delivery invoices now follow the "Tự động in" setting (still printed with the delivery template).
- Service type `SAME_DAY` "Giao trong ngày" (`V18__shipment_service_type_same_day.sql`); default package 10×10×10 cm; address placeholder "Địa chỉ chi tiết (Số nhà, ngõ, đường)".

## Follow-up 2 (2026-10-30): 4 remaining sale-screen features
1. **Bán thuốc theo đơn** — checkbox under customer (normal + delivery modes, hidden for order/return tabs). Fields: mã đơn thuốc, bác sĩ kê đơn, cơ sở khám, chẩn đoán; plain note "Chưa kết nối Hệ thống Đơn thuốc Quốc gia". Stored on invoice (`V19`: `prescription`, `prescription_code/doctor/facility/diagnosis`), returned as `prescription`, shown in invoice detail (`invoice-prescription-info.tsx`), print fields `Thong_Tin_Don_Thuoc`, `Ma_Don_Thuoc`, `Bac_Si_Ke_Don`, `Co_So_Kham`, `Chan_Doan` (default INVOICE template prints the summary). Normal sale; stock deducted as usual; edit can remove it.
2. **Giảm thuế (NQ 204/2025/QH15, 01/07/2025–31/12/2026)** — toggle + ⓘ tooltip under Giảm giá, amount blue; hidden outside window and on order/return tabs.
   - Rule: only lines with product `taxReduction` flag AND tax code VAT10 → 8%; price is VAT-inclusive, reduction = net line amount × 2/110 (110,000 → 108,000, −2,000); invoice discount allocated proportionally first.
   - Server authoritative (`InvoiceTaxReduction`, `InvoiceMath.totals(..., reduceTax)`): window checked on sold date (VN). Stored `invoices.tax_reduction`, `invoice_lines.tax_reduced`; `total` = subtotal − discount − reduction, so existing detail "Giảm thuế" row shows it. Print field `Giam_Thue` (+ row in default INVOICE template).
   - E-invoice: internal source line carries `taxReduced`; MISA payload invoices those lines at 8% (pre-tax from 10%-inclusive price, VAT 8%). Unit tests added (sales `InvoiceMathTest`, integration `MisaInvoicePayloadTest`).
   - Sale catalog (product-service `SaleCatalogRepository`) now returns `taxReduction` per product; cart lines carry it; request line sends `taxReducible` (client flag, server still requires VAT10 + toggle + window).
   - **Direct method (phương pháp trực tiếp) branch NOT implemented**: store tax settings (Thiết lập → Thuế & Kế toán) model household-business sector % rates but have no explicit tax-method (khấu trừ / trực tiếp) field, so per instruction only the 10% → 8% rule is applied.
3. **Branch select** at top of the payment / delivery middle column: only the user's assigned branches, remembered per user on the device. Switching reloads the branch catalog (stock, price books); cart lines stay; existing price-book check drops a no-longer-applicable book and reprices non-edited lines.
4. **Editable "Hóa đơn giao hàng" template** — identity-service `PrintTemplateService.TYPES` + `DELIVERY_INVOICE`; frontend `PRINT_DEFS.DELIVERY_INVOICE` (default = previous delivery template, receiver/shipment/COD + tax/prescription fields, sample data); sale printer uses saved template or default. Old `delivery-invoice-print-template.ts` merged into print module.

### Builds / restarts
- Built sales-service, product-service, integration-service, identity-service (one Maven run, tests pass) and restarted. Frontend `tsc` clean, eslint clean, `next build` OK (includes 0fbd699 sticky headers and 73d0d9e employees fix), :3010 restarted.

### e2e (all pass, own rows cleaned)
- `e2e_delivery.py` 50/50 (new `e2e_sale_tax_rx.py`: TX1 catalog flag, TX2 reduction 2,000 + ineligible line unchanged, TX3 after discount / off, RX1 prescription stored + stock deducted, RX2 removed on edit, BR1 per-branch catalog stock, PT1 DELIVERY_INVOICE template save/restore).
- `e2e_sales.py` 22/22, `e2e_sale_backend.py` 57/57, `e2e_invoice_tools.py` 27/27.

### Browser checks (Playwright, after final restart)
- Invoices + products lists: header row stays fixed while the table scrolls vertically.
- Products: horizontal scroll works (scrollWidth 1378 > 978), expanded detail panel stays sticky-left (left unchanged at scrollLeft 300).
- /employees: filter column fully visible (aside right 242px < table left 253px).
- Sale screen: branch picker (long names truncated), prescription fields, Giảm thuế toggle render; no page errors.

### Unresolved questions
- Need an explicit store tax-method setting (khấu trừ / trực tiếp) before the direct-method reduction (rate × 80%) can be implemented.
- Order (đặt hàng) tabs do not support Giảm thuế / đơn thuốc; invoice created from an order can enable them on the invoice tab.

---

## Follow-up 3 (2026-10-30): tax-reduction trust fix + VAT method

### Security fix (server no longer trusts client eligibility)
- sales-service `TaxReductionPlanner` decides every reduced line from server data only: product-service `POST /internal/products/tax-info` (tax code, `taxReduction` flag, category chain) + identity-service `GET /internal/settings/tax` (method, sectors, category→sector). Both `/internal/**`, service JWT with `internal` authority (same `ServiceTokenProvider` as stock calls); gateway routes only `/api/**`.
- Client `taxReducible` and line `taxCode` are ignored for eligibility (field kept only for old clients). Create, edit and the new preview endpoint all go through the planner; stored `invoices.tax_reduction`, `tax_reduction_method` (V20) and `invoice_lines.tax_reduced` are recomputed on the server.
- Lookup failure → 503 `TAX_LOOKUP_DOWN` before any stock change (no silent reduction).
- Tests: `TaxReductionPlannerTest` (forged flags ignored, sector mapping, no calls when off/out of window); e2e SEC1–SEC3 (forged request: only truly eligible line reduced = 2,000; forged-only cart = 0; edit with forged line = 0; preview matches).

### VAT method setting + direct-method rule
- Thiết lập → Thuế & Kế toán: "Phương pháp tính thuế GTGT" radio Khấu trừ (default) / Trực tiếp trên doanh thu (`TaxSettings.vatMethod`, old saves read as DEDUCTION). i18n vi/en/zh/ja.
- Khấu trừ: unchanged (flag + VAT10 → 8%, net × 2/110).
- Trực tiếp: product with `taxReduction` flag (its VAT code is ignored — direct-method goods have no VAT rate); rate = sector % of the nearest category in the product's category chain mapped in `categorySectors`, else `defaultSector` (same model the tax books use); reduction = net line revenue × rate% × 20% (1,000,000 × 1% × 20% = 2,000); sector rate 0 → no reduction. Same date window.
- Display: sale totals use server preview `POST /api/invoices/tax-reduction-preview` (method label next to amount; offline falls back to a deduction estimate, server recomputes on save); invoice detail "Giảm thuế (khấu trừ/trực tiếp)"; print fields `Giam_Thue`, `Phuong_Phap_Giam_Thue` (rows in default INVOICE and DELIVERY_INVOICE templates).
- E-invoice: deduction lines go to MISA at 8% (verified by unit test). **Direct method: MISA field/format for "giảm 20% tỷ lệ %" on a sales invoice could not be verified**, so integration-service refuses to auto-publish such invoices (400 `EINVOICE_DIRECT_TAX_REDUCTION_UNSUPPORTED`, clear message) instead of sending totals that don't match lines.
- e2e DM1–DM3: direct method (sector mapped temporarily) = revenue × rate × 20%, after invoice discount, preview matches; settings restored to Khấu trừ with the original category mapping.

### Builds / runs
- Rebuilt sales, product, integration, identity (tests pass) + frontend (`tsc`, eslint, `next build`), all restarted, health 200.
- e2e: delivery 56/56, sales 22/22, sale_backend 57/57, invoice_tools 27/27, store_profile 66/66.
- Note: after e2e_store_profile the app shows the Terms-of-use acceptance dialog on first page load (other feature), settings page loads with no errors.

---

## Task 3 (2026-10-30): Vận đơn / Quản lý giao hàng / Đối tác giao hàng (KiotViet 227–238)

### Backend (sales-service)
- Shipment statuses extended to KiotViet's 12: + Đã lấy hàng (PICKED), Chờ lấy lại (WAIT_REPICK), Chờ giao lại (WAIT_REDELIVER), Chờ chuyển hoàn (WAIT_RETURN), Chờ chuyển hoàn lại (WAIT_RERETURN); RETURNING relabelled "Đang chuyển hoàn". They are pure workflow states — ledger/debt posting still only at Giao thành công / Đã chuyển hoàn / Đã hủy (ShipmentStatusWriter unchanged), so balances stay correct. Cancel allowed only before pickup (Chờ xử lý / Đang lấy hàng / Chờ lấy lại). Invoice state, partner "cần thu hộ" and filters updated for the new states.
- `GET /api/shipments` new filters: completedFrom/To (delivered_at), cod (true/false), connection (MANUAL), search also by partner waybill code; items carry customerId/code, waybillCode, expectedDeliveryAt, deliveredAt, serviceType. Detail adds item quantity, invoice note, packages + dimensions, codOpen, partnerFee, partnerFeeOpen.
- `GET /api/shipments/dashboard` (counts / COD / fee by status, Chờ giao lại, Chờ chuyển hoàn, quá giờ giao dự kiến) and `GET /api/shipments/cashflow` (partner ledger in period: COD collected, fees, net settlements, current balance).
- Partners: `codOpen` / `feeOpen` (posted, not reconciled), `shipmentTotal`, list sums; `GET /api/delivery-partners/settlements` (all partners).

### Frontend
- **Vận đơn** (`/delivery/shipments`): KiotViet header (search "Theo mã vận đơn" + slider icon, Đối soát, Xuất file xlsx of all filtered rows / shown columns, column chooser, gear, "?" help), left filters (status multi-select, partner, Thời gian tạo default Tháng này, Thời gian hoàn thành default Toàn thời gian, Khu vực = province, COD Tất cả/Có/Không), columns per screenshots (+ Người nhận, Điện thoại, Địa chỉ, Khu vực, Thu hộ, Phí giao hàng, Thời gian hoàn thành, Dịch vụ, Mã vận đơn nội bộ), summary row, bulk status bar. Expanded row: Thông tin (người nhận / hóa đơn 2 cột + collapsible "Thông tin vận chuyển" 3 cột; TL quy đổi = D×R×C/6000 kg shown in g with ⓘ formula) and Lịch sử giao hàng (time, partner, created by, status badge); status / edit actions kept.
- **Quản lý giao hàng** (`/delivery`, replaces the old bulk page whose bulk-update/reconcile moved to Vận đơn): back arrow title, "⟳ Cập nhật lúc HH:mm" refresh, QUẢN LÝ (Thống kê / Dòng tiền), filters Hình thức kết nối (Tất cả / Trực tiếp qua cổng giao hàng + Kết nối tài khoản HVC disabled "Chưa kết nối" / Tự giao hàng), Đối tác (searchable, Tất cả, partners, Khác = all self-managed), Thời gian tạo đơn (Hôm nay / Hôm qua / 7 ngày qua ✓ / Tháng này / Tháng trước / Tùy chọn range). Cards, summary, SVG donut (count/COD/fee) + legend, status table with total row; cards/rows/"Xem chi tiết" open Vận đơn pre-filtered.
- **Đối tác giao hàng**: left card Tích hợp (own icon illustration, text, help link; no partners) / Khác (store partners + status/debt filters); tabs Thông tin (7 columns from shipments + totals, column chooser, xlsx export disabled when empty), Lịch sử giao hàng (shipments of all partners), Lịch sử đối soát; empty state "Không tìm thấy kết quả nào phù hợp"; create/edit modal and detail panel kept.

### Not built / substitutions
- Card "Đơn điều chỉnh cước vận chuyển 24h qua" and columns "Tiền bồi hoàn", "GTB-Thu tiền": no carrier integration / no data → left out.
- "Đơn hàng giao thất bại" = shipments in Chờ giao lại.
- Khu vực filter: address model is 2-level (Tỉnh/TP → Phường/Xã, post-2025), no Quận/Huyện → filter by province.
- Gear: no dedicated delivery settings page exists → opens Thiết lập → Đơn hàng.
- Delivery history tab shows the current partner for each status change (logs don't store the partner).

## Task 4: Trả hàng list (239–242)
- Backend `GET /api/sales-returns`: types (INVOICE / QUICK / SHIPMENT=chuyển hoàn), deliveryStatuses + partnerId (via the return's shipment, else invoice's latest shipment); items add type, seller, customer code, branch, created time/by, channel, note, discount, sale shipment code/status, partner. `GET /api/sales-returns/export` (≤5,000 returns + lines). Return picker also finds invoices by partner waybill code.
- Frontend `/returns`: search "Theo mã phiếu trả" + slider, "+ Trả hàng" (→ /sale?returnPicker=1 opens "Chọn hóa đơn trả hàng"), "Xuất file ▾" File tổng quan / File chi tiết (xlsx via the invoice file-jobs panel), 2-column column chooser (defaults as 242), gear (Thiết lập → Đơn hàng), "?" help; filters Loại trả hàng, Trạng thái (Đã trả ✓, Đã hủy ☐), Trạng thái giao hàng, Đối tác, Thời gian; checkbox + ☆ columns (☆ stored per user on this device); empty state with "vào đây" → all time; stickyHeader.
- Picker dialog (241) already matched (filters all server-side, primary header, pagination, Trả nhanh → existing quick-return tab); only the URL entry point was added.
- Left out (no data): Loại "Hoàn tiền"; Trạng thái "Đang xử lý" (returns are only Đã trả / Đã hủy); Trạng thái HĐĐT filter + columns Trạng thái HĐĐT / Mã số HĐĐT (no e-invoices for returns); CSDL dược filter/columns; columns Mã vận đơn trả, Người nhận trả, Tổng tiền hàng sau thuế, VAT hoàn lại, Giảm thuế hoàn lại, Thu khác hoàn lại.

### Verification
- sales-service built (tests pass) + restarted; frontend tsc / eslint clean, `next build` OK, :3010 restarted.
- e2e: delivery 71/71 (new KV1–KV10 shipments/dashboard/cashflow/partners vs DB incl. TL quy đổi dims, RT0–RT4 returns filters/columns/export/picker), sales 22/22, sale_backend 57/57, edit_return 18/18, invoice_tools 27/27.
- Browser (Playwright): Vận đơn list + expanded detail, Quản lý giao hàng (Thống kê, Dòng tiền), Đối tác (Tích hợp, Khác), Trả hàng, return picker — rendered, no page errors.

## Task 5 (2026-10-30): Đặt hàng (243–278)
Backend (9b73085): list filters productQ/customerQ/deliveryFrom/To/sellerId/channels/paymentMethods, GET /orders/export, PATCH /orders/{id}/info, POST /orders/{id}/finish, cancel guard + CANCEL_VOUCHERS, invoice cancel ?cancelPayments=, delivered qty per line, ORDER print type (identity).
Frontend: /orders list (search "Theo mã phiếu đặt" + panel hàng/khách, + Đặt hàng → /sale?newOrder=1, Xuất file tổng quan/chi tiết xlsx, column chooser, ☆ local, status chips, Thời gian giao hàng, PT thanh toán, Người tạo/nhận đặt, Kênh bán + Tạo mới, summary row, empty "vào đây"); detail panel (editable Người nhận đặt / Ngày đặt / Kênh bán / Dự kiến giao / Trạng thái / Ghi chú + Lưu, ordered + delivered (red) qty, tabs Thông tin / Lịch sử thanh toán / Lịch sử hóa đơn, footer Hủy (2 dialogs) · Sao chép · Xuất file · Xử lý đơn hàng · Lưu · Kết thúc · In); sale screen: tab "DHxxx" (Xử lý) with TẠO HÓA ĐƠN (purple) + LƯU (green), Khách đã trả → Khách cần trả = còn lại, payment hidden when deposit covers, "Tính vào công nợ"; TẠO HÓA ĐƠN saves order then replaces tab with "Hóa đơn N" (THANH TOÁN, deposit deducted); ?copyOrder= → "Copy_DHxxx"; customer-required toast + focus; invoice cancel "Hủy thanh toán" dialog; invoice payments "(Chuyển tạm ứng)" on TT{DH} rows; print "HÓA ĐƠN ĐẶT HÀNG" (ORDER) with VietQR of remaining amount.
Verification: e2e_orders_flow 14/14 (OF14 new: deposit 5k + invoice paid 0 → debt), orders_groups 34/34, sales 22/22, sale_backend 57/57, invoice_tools 27/27, delivery 71/71; tsc/eslint clean; next build; screenshots list/detail/sale tabs, no JS errors.

### Business-logic changes
- Order cancel: blocked when invoice exists ("Phiếu đặt hàng đã có hóa đơn, không thể hủy", ORDER_HAS_INVOICE). New refundMethod CANCEL_VOUCHERS: cancels deposit receipts (PAYMENT_CANCEL debt +amount), no refund voucher. UI: "Đồng ý" = CANCEL_VOUCHERS, "Bỏ qua" = CREDIT (deposit kept as customer prepayment). Cash refund (PC{code}) still in API, no longer in UI.
- Invoice cancel (invoice from order): cancelPayments=true cancels the order's deposit receipts too (order deposit → 0, debt restored); false keeps them (order reopens CONFIRMED with deposit).
- Order finish: DRAFT/CONFIRMED → COMPLETED without invoice; no stock change; deposit receipts stay PAID; order can't be invoiced afterwards.
- Order info save: seller, orderedAt (book-lock checked on old+new date), channel, expected delivery, note; status only DRAFT↔CONFIRMED while open; cancelled orders read-only.
- Order creation: unchanged (customer required, receipt TT{code} only when paid > 0, reduces debt immediately; no stock).
- Invoice from order: unchanged server rule — deposit allocated "(Chuyển tạm ứng)", new payment → 2nd receipt TT{HĐ}; unpaid remainder goes to customer debt at invoice time (not at order time — posting at order time would double count).
- TẠO HÓA ĐƠN from order tab now first PUTs the order (cart/note; any "Khách thanh toán" typed there = extra deposit receipt) then opens the invoice tab.

### Not built (reported)
Gộp đơn; Đối tác giao hàng / Khu vực filters and "Đang giao hàng" status (orders have no shipment/address); row checkboxes (no bulk action without Gộp đơn); VAT/Giảm thuế lines on orders (orders carry no tax data); "Mở rộng" in search panel; "SL / SL đặt" (1 / 1) under invoice-tab lines.
