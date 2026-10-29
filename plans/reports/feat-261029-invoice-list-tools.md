# Hóa đơn list tools — create, import, export, merge, columns (261029)

Branch `feature/phase-01-foundation`. Commits: b44ead2 (backend), a2082d4 (frontend), 17fc674 (auto), e00373d (fixes).

## What was built

| Item | Where | Notes |
|---|---|---|
| "+ Tạo mới ▾" → Hóa đơn | toolbar → `/sale?new=1` | new hook `use-sale-new-tab-param.ts` + 1 line in `sale-screen.tsx`, opens a NEW invoice tab once saved tabs are loaded. KShip omitted. |
| Import file | `invoice-import-dialog.tsx`, `invoice-import-template.ts`; backend `POST /api/invoices/import` | Template .xlsx: group row (Thông tin hóa đơn / khách hàng / hàng hóa / thanh toán) + 25 columns + 3 sample rows (HDIP00001 ×2 lines, HDIP00002). Reads .xlsx/.csv in browser (SheetJS, Excel date serials → dd/MM/yyyy [HH:mm]). |
| Xuất file tổng quan / chi tiết | `invoice-xlsx-export.ts`, `invoice-export-fields.ts`, `invoice-export-column-dialog.tsx`, `invoice-file-jobs-panel.tsx`; backend `GET /api/invoices/export` | ALL invoices matching sidebar filters + search (max 5000), not just the page. .xlsx with autofilter on whole range, money `#,##0`, real date cells, `'` prefix on text starting `= + - @`. Names `DanhSachHoaDon_KV<ddMMyyyy-HHmmss-SSS>.xlsx` / `DanhSachChiTietHoaDon_KV…`. Detail = 1 row per invoice line; column modal with group counts, 2-col grid, "Bỏ chọn tất cả", Bỏ qua / Xuất file; selection remembered (localStorage). Bottom-right panel "Xử lý thiết lập, import, xuất file, thanh toán" with "Nhấn vào đây để tải xuống" (none existed → new). |
| "…" → Gộp đơn | `invoice-merge-dialog.tsx`; backend `GET /api/invoices/merge-candidates`, `POST /api/invoices/merge` | Groups by customer, pick ≥2 of one group, empty state with inbox + reason (KiotViet order message or generic). |
| Column show/hide | `invoice-column-picker.tsx`, `invoice-list-prefs.ts`, `invoice-list-cells.tsx` | 3-column checkbox popover (column-major like 219), Mã hóa đơn fixed. 34 columns with data. |
| Gear / "?" | toolbar | gear → /settings/orders (kept); "?" → KiotViet guide URL, `target=_blank rel=noopener noreferrer`. |

Backend (sales-service, Controller → Service → Repository, SQL only in `@Repository`): `InvoiceToolsController`, `InvoiceExportService/Repository/Dtos`, `InvoiceListParams`, `InvoiceImport{Service,Planner,LinePlanner,Cells,Repository,LookupClient,Dtos}`, `InvoiceMerge{Service,Writer,Repository,Dtos}`; list query extended (`InvoiceQueryRepository`, `InvoiceFilterSql.TABLES`), `InvoiceService.create(req, actor, fixedCode, lineLots)` overload (normal path unchanged). Migration **V17** `invoice_updated_at_and_merge`: `invoices.updated_at` (trigger) + `merged_into_id`.
product-service `InternalStockService`: SALE line with `lotNumber` → exact lot (must exist at branch, unexpired, enough qty); new `SALE_MERGE`; SALE_CANCEL/REPLACE also reverse SALE_MERGE docs. identity-service: `/api/users/lookup` now also returns `username`.

## Rules chosen

- **Import = all-or-nothing validation, per-invoice commit.** Whole file validated first (line number + Vietnamese message); any error → nothing saved. Valid file → invoices created one by one through `InvoiceService` (stock exact lot, TT{code} vouchers, debt). An unexpected failure mid-way (e.g. lot sold meanwhile) stops and is reported in `failed`; earlier invoices stay (in `created`). Same import id resent → already-imported invoices `skipped` (ids derived from import id + code).
- Resolution: seller = username or full name; channel = name/code (active); customer = code → phone → create if name given (else error), none = walk-in (must pay full); price book = name ("Bảng giá chung"/blank = base); product = unit code (or barcode); blank Đơn giá → price book / base price; Giảm giá % or amount per unit; lot required for lot-managed, must exist at branch, unexpired, Hạn sử dụng must match, cumulative per-lot qty across file checked; non-lot stock checked unless negative stock allowed. Codes ≤30, `[A-Za-z0-9_./-]`, unique; `HD`+digits rejected (reserved for the sequence). Payments: Thẻ is main method (TT{code}), Tiền mặt / Chuyển khoản are extras (TT{code}-2…).
- **Merge**: eligible = COMPLETED, last 7 days, same branch, same customer id (walk-ins by same name), no completed return, no active shipment, no published/accepted e-invoice, linked order COMPLETED, no foreign allocations (debt receipts / order deposits). One `SALE_MERGE` stock call (reverse old docs + re-issue same lots → stock net zero; old docs marked SALE_CANCEL) then ONE DB transaction: new invoice with all lines (cost + lots + line lots copied), sum subtotal/discount/total/paid, original vouchers re-pointed (first TT = main, others INVOICE_EXTRA → cashbook untouched, cancelling merged invoice cancels them), originals CANCELLED + `merged_into_id` + paid 0, debt: SALE_CANCEL per original + SALE for new (balance unchanged), linked orders re-pointed, audit "Gộp đơn". Idempotent by client merge id; re-merging cancelled originals → 400. Requires `sales.perform` + `sales.cancel`.

## Omitted (no backing data)

- List columns: Trạng thái / Ghi chú CSDL về dược, Mã đối soát, Bác sĩ, Tổng tiền hàng sau thuế, VAT, Giảm thuế, Chiết khấu thanh toán, Tên nhà cung cấp. Old non-KiotViet "Thanh toán" column dropped (saved prefs filtered).
- Detail export: Trạng thái / Ghi chú CSDL về dược, Địa chỉ lấy hàng, Mã đối soát, Bác sĩ, Giá trị VAT, VAT, Có dùng VAT, Trạng thái Áp dụng giảm thuế, Giá trị giảm thuế (resulting groups: Hóa đơn 18, Thanh toán 5, Khách hàng 8, Hàng hóa 16, Giao hàng 18, Thông tin khác 2). "VAT(%)" = line tax code.
- Row checkbox column: skipped (nothing real uses it — export uses filters, merge has its own picker).

## Tests

- New `scratchpad/e2e_invoice_tools.py` (+ `invoice_tools_harness.mts`, `invoice_tools_alias_hook.mjs`: runs the real frontend template/parser/xlsx-export code in Node against the BFF): **27/27** — template, import success (lots, stock, debt +70k, TT/TT-2 vouchers, new customer, idempotent resend), import errors (13 kinds, nothing saved), overview/detail export (filters, chosen columns, values, formula guard, dates), new list columns + updated_at, merge eligible/ineligible, totals, stock/debt/vouchers unchanged, idempotency, audit, cancel merged invoice. Cleans its own data.
- `e2e_invoice_filters.py` 15/15, `e2e_sales.py` 22/22. Backend unit tests pass; `tsc --noEmit` clean; eslint clean on touched files.

**Status:** DONE_WITH_CONCERNS
**Summary:** Invoice list now has create (new sale tab), import with template (validate-all, per-invoice commit), full-filter xlsx overview/detail export with column picker and download panel, merge invoices (one stock call + one DB transaction), 34-column picker, help link; real backend in sales/product/identity services, covered by a new 27-check e2e.
**Concerns:**
- Frontend on :3010 is a `next start` build — UI changes need `npm run build` + restart (not done: shared server, low RAM). UI not compared visually against the screenshots.
- Merge: if the DB step fails after the stock step, retrying the same merge id finishes it; abandoned, the originals stay COMPLETED with stock docs already marked cancelled (cancelling one later would not return stock). No reconciler for this (unlike checkout).
- Thẻ vs Chuyển khoản split in detail export relies on the main voucher; a card paid as an extra method on the sale screen is counted as Chuyển khoản.
- `/api/users/lookup` now exposes usernames to every signed-in user.
- Merged invoice keeps original voucher codes (TT{old code}); delivery invoices cannot be merged.
- `e2e_sales.py` leaves its own test rows (pre-existing behaviour), not cleaned by me.
