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
