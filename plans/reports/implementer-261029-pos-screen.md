# POS / Bán hàng rebuilt to match KiotViet (156–170): report (2026-10-29)

Frontend: `frontend/src/features/pos`. Backend (sales-service): handed to a sub-agent, see `implementer-261029-pos-backend.md`.
No next build/dev was run, so nothing has been tested in a browser.

## Layout (matching the screenshots)
- **Blue top bar**
  - Search "Tìm hàng hóa (F3)" with a list icon (multi-select mode) and a scan icon (quick add by scanning).
  - Tabs ‹ › with ⇄ on the active tab and ×; (+) adds an invoice and ▾ offers Thêm hóa đơn / Thêm đặt hàng.
  - Icons: bag = Xử lý đặt hàng, ↩ = Chọn hóa đơn trả hàng, ⟳ = Đồng bộ phiếu (badge with pending count, orange when offline), printer = Thiết lập in.
  - User name, then the ☰ menu.
- **Cart line**
  - STT, trash, Mã hàng (DocCodeLink newTab), Tên hàng (+ Tồn / Giá gần nhất), blue unit badge, quantity, đơn giá, thành tiền, (+) thêm dòng, ⋮.
  - Columns follow the settings.
  - Line discount can be entered in VND or %.
- **Right panel**
  - Seller, channel icon "🚶▾" (Kênh bán: KiotViet's channel picker; Bán trực tiếp = walking figure), date/time.
  - Customer (F4) + price book.
  - Tổng tiền hàng, Giảm giá, Khách cần trả, Khách thanh toán (QR + `#pos-paid`).
  - Radios + ⋮ "Thanh toán nhiều phương thức", suggested amount chips, THANH TOÁN.
- **Bottom of cart area:** "Ghi chú đơn hàng" + "Thông tin xuất HĐĐT · Chi tiết". The dialog collects Tên người mua, Tên đơn vị, MST, Địa chỉ, Email, SĐT. It is prefilled from the customer profile when online and saved as `einvoiceBuyer` on the invoice, both on create and on edit.
- **Footer:** Bán nhanh / Bán thường / Bán giao hàng, plus a help button that opens the shortcut list.
- Kept: price book, channel, delivery form, order/edit/return/orderInvoice tabs, `?copy=` (new, uses `draftCopyOfInvoice`).

## Features
- **Xử lý đặt hàng:** 5 underlined filters plus a date range (default 30 days back) → `GET /orders/pos-search`. Clicking a row opens the order to create an invoice.
- **Chọn hóa đơn trả hàng**
  - 6 filters, time range, sort by Thời gian ▾, 7 rows per page with page numbers and "Hiển thị x - y trên tổng số N hóa đơn".
  - The invoice code is a DocCodeLink opening `/invoices?code=` in a new tab; "Chọn" opens the return tab.
  - **Trả nhanh** opens a "Trả hàng N" tab with no invoice: add goods like a cart, pick the lot for lot-managed goods (`/products/{id}/lots` at the branch), choose an optional customer, and a walk-in customer must be refunded in full.
- **Đồng bộ phiếu**
  - Replaces `pos-queue-dialog.tsx` (deleted).
  - Loại phiếu filter, connection status (Có Internet / Mất kết nối shown red), table, "Đồng bộ tất cả", and per-row resend/delete.
  - The offline queue now holds invoices, returns (both invoice-based and quick) and new orders. The backend confirmed all three create APIs are idempotent by id.
  - Editing an order and editing an invoice remain online-only.
- **Thiết lập in:** auto print, merge same items, number of copies (1–10, one page each), and the invoice template pill. The shop has exactly one INVOICE template, so there is one pill. Auto print runs after paying.
- **☰ menu:** Quản lý / Báo cáo cuối ngày (open in a new tab so the cart is kept), the 4 functions, Thiết lập & Hiển thị, Phím tắt, Đăng xuất.
- **Lập phiếu thu**
  - Calls `POST /customers/{id}/payments`, which allocates to the oldest invoices first.
  - Shows the collection method under ⋮, debt after payment, a DateTimePicker, note, "Tổng thanh toán cho hóa đơn" (= min(amount, unpaid invoices)) and "Trừ vào công nợ".
  - "Tạo phiếu thu & In" prints using the CASH_RECEIPT template.
- **Import file**
  - The template `.xlsx` is generated in the browser with the 15 columns in order.
  - Each sheet becomes one new invoice tab, up to 19 sheets × 250 rows.
  - Products are matched by unit code or barcode. A blank price uses the selling price; Giảm giá (%) takes precedence over Giảm giá (VND).
  - Customers are matched by code, then phone, otherwise created (Cá nhân/Công ty, Khu vực/Phường xã → 2025 admin-unit codes).
  - Errors are reported per sheet and per row, and a sheet with errors is not imported.
- **Settings** persist per device under `pos.settings`; details below.
- **Shortcuts:** handled in one place (`use-pos-shortcuts.ts`), replacing the old F3/F4/F9 listeners that lived in individual components.
  - F1–F11 as specified (F6 toggles "thêm hàng → con trỏ vào ô số lượng").
  - Home/↑/↓/Enter/Shift act on the selected line.
  - Line keys do not fire while typing in a text field or when a button is focused, but they do work inside the quantity input.
  - When a dialog is open only F4 works.
- **Speech:** reads the amount paid aloud after a successful payment (vi-VN).

## Omitted settings / shortcuts (cannot work)
- **Bán thuốc theo đơn:** pharmacy feature.
- **Giảm thuế (toggle):** the catalog has no `taxReduction` and invoices have no reduction field; it would need product-service plus an InvoiceMath change.
- **Ảnh hàng hóa:** shown disabled with the tooltip "Hàng hóa chưa có ảnh".
- **Thành phần combo:** there are no combos.
- **Lô - hạn sử dụng (display):** the catalog has no lots and invoices auto-allocate lots by FEFO; there is no lot choice when selling.
- **Thiết lập giá, Cây hiển thị giá:** omitted; meaning unclear and they need price updates in product-service.
- **Tự động hoàn thành đơn khi quét QR:** shown only when SePay is enabled. The POS setting now decides, replacing the server's autoComplete flag.
- **F7 (cash drawer), F10 (electronic scale), Ctrl+F10 (sample prescriptions):** need hardware or a pharmacy feature.
- **Import "Lô / Hạn sử dụng":** read but not applied, because the invoice line has no lot field (server uses FEFO).
- **"Sắp xếp hàng hóa theo" + ↑↓:** implemented as sort field (Số thứ tự / Mã hàng / Tên hàng) + direction. Drag & drop only works when sorting by Số thứ tự.

## Files
- **New (features/pos):**
  - pure logic: `pos-settings.ts`, `pos-suggested-amounts.ts`, `pos-shortcuts.ts`, `pos-import-parse.ts`, `pos-import-map.ts`, `pos-payment-split.ts`
  - hooks: `use-pos-settings.tsx`, `use-pos-shortcuts.ts`, `use-pos-line-keys.ts`, `use-pos-invoice-submit.ts`, `use-pos-return-submit.ts`, `use-pos-invoice-printer.ts`, `use-pos-last-prices.ts`, `use-pos-url-drafts.ts`
  - dialogs: `pos-dialog-parts.tsx`, `pos-sync-dialog.tsx`, `pos-order-picker-dialog.tsx`, `pos-return-picker-dialog.tsx`, `pos-receipt-dialog.tsx`, `pos-import-dialog.tsx`, `pos-settings-dialog.tsx`, `pos-settings-tabs.tsx`, `pos-shortcuts-drawer.tsx`, `pos-einvoice-dialog.tsx`, `pos-mixed-payment-dialog.tsx`
  - parts: `pos-import-workbook.ts`, `pos-paid-section.tsx`, `pos-channel-picker.tsx`, `pos-print-settings-popover.tsx`, `pos-main-menu.tsx`, `pos-quick-return-lot.tsx`, `pos-screen-dialogs.tsx`
- **Modified:** `pos-screen.tsx` (176 lines), `pos-header.tsx`, `pos-invoice-tabs.tsx`, `pos-checkout-panel.tsx` (keeps DateTimePicker), `pos-cart.tsx`, `pos-cart-line.tsx`, `pos-product-search.tsx`, `pos-customer-picker.tsx`, `pos-return-checkout.tsx`, `pos-return-panel.tsx`, `pos-footer.tsx`, `pos-types.ts`, `pos-storage.ts`, `pos-invoice-body.ts`, `pos-add-product.ts`, `pos-open-invoice.ts`, `use-pos-tabs.ts`, `use-offline-queue.ts`, `use-pos-order-submit.ts`.
- **Deleted:** `pos-queue-dialog.tsx`.
- **package.json:** `xlsx` = `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`, exact pinned version.
  - Why: it is SheetJS's official CDN build, version 0.20.3 (2024), well over 2 weeks old.
  - The npm-registry `xlsx@0.18.5` is abandoned and has known CVEs.
  - It reads and writes multiple sheets in the browser and is loaded with dynamic `import()`, so it is not in the POS bundle until Import is used.

## Refactor notes for the rename (pos → sale)
- **Storage keys:** all in `pos-storage.ts` `KEYS`: `pos.catalog.<branch>`, `pos.customers`, `pos.tabs.<user>`, `pos.queue`, `pos.lookups`, `pos.settings` (new).
- **Route:** the single constant `SALE_ROUTE = "/pos"` in `pos-storage.ts`, used by `use-pos-url-drafts.ts`. There are no other hard-coded "/pos" strings in features/pos.
- **DOM ids:** `pos-product-search`, `pos-customer`, `pos-receipt-customer`, `pos-paid`, `pos-qty-<key>`, plus the `data-pos-qty` attribute.

## Tests
- `npx tsc --noEmit -p .` is clean; `npx eslint src/features/pos tests/pos-logic.test.mjs` is clean.
- `node --experimental-strip-types --test tests/pos-logic.test.mjs`: **8/8**. Covers suggested chips, shortcut map / typing rules, settings merge, Excel number parsing, sheet parsing (limits, headers, per-row errors, customer), catalog mapping, admin-unit matching against the real 2025 dataset, and payment split.
- **Backend (sub-agent):** `e2e_pos_backend.py` 47/47; regressions e2e_delivery 37/37, e2e_reports 39/39, e2e_orders_groups 34/34, e2e_edit_return 18/18, e2e_sales 22/22, e2e_offline_sync PASS. V13 applied and sales-service running on :8086.

## Unresolved questions
- Quick returns only accept lots already present at the branch (product-service SALE_RETURN does not carry an expiry date). Should new lots be allowed? That needs a product-service change.
- Mixed payment: the backend silently caps the primary method at (amount due − Σ extras). The frontend already reduces cash first, so it is consistent. A strict 400 is an option.
- Should quick returns reduce commission (SellerRevenue) for the person who created them? Currently they do not.
- Vouchers with source_type `INVOICE_EXTRA` (TT{code}-2…): the admin cashbook / invoice detail pages may need to recognise them as invoice vouchers (another agent owns those pages).
- `InvoiceService.java` is now 235 lines, over the 200-line guideline.

**Status:** DONE_WITH_CONCERNS
