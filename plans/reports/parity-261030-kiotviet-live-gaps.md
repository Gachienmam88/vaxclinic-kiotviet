# KiotViet live parity: Hàng hóa, Nhập hàng, NCC, Hóa đơn (261030)

Source: `scratchpad/kiotviet-live-observations-261030.md` (read-only browse). I did not browse the live site.
Status: DONE_WITH_CONCERNS (see the end).

Commits: `6993100` products + backend, `1a9d4df` purchases, `a3ab9af` invoices + route guard. The auto hook had already committed the new helper files (`6d7d346`, `5db66b5`, `a35085d`, `e211dad`, `75f4900`).

## Gap list

Legend: **E** = exists, **D** = differs (fixed unless noted), **M** = missing (implemented unless marked "skipped").

### Hàng hóa
| Item | E / D / M | Result |
|---|---|---|
| List cols Mã, Tên (+ĐVT), Tên viết tắt, Giá bán, VAT, Áp dụng giảm thuế, Tồn, summary row | E | — |
| Giá vốn up to 2 decimals | E | `formatNumber` already shows ≤2 decimals |
| "· Hộp ▾" unit switcher on rows with several units | M | Done. The list API returns `units[]`. Switching changes the code and sale price, cost = base × rate, stock / reserved = base ÷ rate |
| Image thumb (list + detail) | M | Skipped: there is no product image column or upload. The detail keeps its icon placeholder |
| "---" stock for services | M | Skipped: no service product type |
| ☐ / ☆ columns, column chooser, Import file, "+ Tạo mới ▾" | M | Out of scope (not requested). Product import does not exist |
| Filters (nhóm, thuế, giảm thuế, tồn, dự kiến hết hàng, thời gian tạo) | E | — |
| Detail tabs Thông tin / Mô tả, ghi chú / Thẻ kho / Tồn kho | E | We also have "Hàng hóa cùng loại". "Liên kết kênh bán" skipped (no data) |
| Badges Hàng hóa thường / Bán trực tiếp / Không tích điểm (orange) | E | — |
| Grid fields, Mã vạch "Chưa có" grey, Định mức "0 - 999,999,999" | E | — |
| Box "Nhà cung cấp" | M | Done: suppliers on COMPLETED receipts that contain the product, most recent first, as blue links to the supplier |
| "Thêm thuộc tính" | M | Skipped: no attribute model |
| Footer 🗑 Xóa, Sao chép \| Chỉnh sửa, In tem mã, "…" | D | Done. Sao chép opens the create form pre-filled (codes, barcodes, id and cost cleared). In tem mã prints one Code 128 label per unit. "…" holds Ngừng / Cho phép kinh doanh |
| Thẻ kho with Đối tác | E | We also show Giá GD, Chi nhánh and Lô |
| Tồn kho tab: KH đặt, Dự kiến hết hàng per branch, Trạng thái badge, total row | D | Added a Dự kiến hết hàng column (backend `stocks[].expectedOutDays`, same formula as the list, per branch). The status badge is green / red |

### Nhập hàng
| Item | E / D / M | Result |
|---|---|---|
| Filters (trạng thái, thời gian, người tạo, số HĐ đầu vào, người nhập), columns, summary, 15 rows | E | CSDL dược columns / filter skipped (no data) |
| Detail header, Người tạo / Người nhập / Ngày nhập / Tên NCC link, Ghi chú, Số lượng mặt hàng | E | — |
| Line search "Tìm mã / Tìm tên hàng" | E | — |
| "🏷 Thiết lập giá" link + price-tag per line | M | Done. The header link opens Thiết lập giá. Each line's tag opens `/products/price-books?code=<mã>`; the price-books page now accepts `?code=` |
| Footer 🗑 Hủy, Xuất file \| Mở phiếu, Lưu, Trả hàng nhập, In tem mã, "…" | D | Done: Sao chép moved into "…", In tem mã added (copies = ceil(qty) per line, sale price from the catalog). Our "In" (A5 print) is kept and noted |
| Cost columns hidden without cost permission | M | Skipped: there is no cost permission (see Permissions) |

### Nhà cung cấp
| Item | E / D / M | Result |
|---|---|---|
| Filters Nhóm NCC (+Tạo mới), Tổng mua (từ/tới + thời gian), Nợ hiện tại, Trạng thái | E | We have an extra "Ngừng hoạt động" chip |
| Columns Mã, Tên, Email, Nợ, Tổng mua + bold summary | D | Not changed: ours also shows Điện thoại by default (KiotViet likely hid it because of the phone permission) |
| Detail header, Người tạo \| Ngày tạo \| Nhóm, Email, Địa chỉ "Chưa có" | E | — |
| Box "Thông tin xuất hóa đơn" | E | — |
| "✎ Chưa có ghi chú" inline note | E | — |
| Footer 🗑 Xóa \| Chỉnh sửa, 🔒 Ngừng hoạt động | E | — |
| Tab "Nợ cần trả nhà cung cấp" | E | We also have a "Lịch sử nhập/trả hàng" tab |
| Phone masked "****8288" | M | Skipped: no permission controls it |

### Hóa đơn
| Item | E / D / M | Result |
|---|---|---|
| Header, Người tạo / Người bán / Ngày bán / Kênh bán / Bảng giá, lines, totals, Ghi chú, tabs | E | — |
| Box "Hoá đơn điện tử": badge, số HĐĐT + ↗, Ngày phát hành, Tính chất | E | Tính chất is always "Gốc": there is no replacement / adjustment data |
| Người mua "tên / địa chỉ / SĐT" | D | Phone added (frontend only) |
| Footer: no In / Sao chép / Xuất file when e-invoiced | D | Done: hidden when the e-invoice is PUBLISHED. Non-e-invoiced invoices keep ours |
| "…" → Xem hóa đơn điện tử, Cách tra cứu, Sửa tỷ lệ thuế | M | Done. Xem opens the MISA lookup URL. Cách tra cứu opens a dialog with the site and the lookup code (`transaction_id`). Sửa tỷ lệ thuế already existed |
| List filters / columns incl. CSDL dược | E / skipped | The CSDL dược columns are skipped |

### Permissions
| Item | E / D / M | Result |
|---|---|---|
| No-permission page → Tổng quan + toast "Bạn không có quyền xem thông tin này." | M | Done: `RoutePermissionGuard` in the admin layout uses the same route→permission map as the menu. Settings and store-profile keep their own checks |
| Cost / price columns hidden + supplier phone masked without cost permission | M | Skipped: `Permissions.java` has no cost or phone permission. It needs a new permission plus backend field stripping, which overlaps the audit agent's permission work |

## Skipped (no data source / no model)
CSDL dược (columns, filters), Liên kết kênh bán, Thêm thuộc tính, product images, service products ("---" stock), cost/phone permission, e-invoice Tính chất Thay thế/Điều chỉnh, product import, column chooser / ☆ favourites.

## Business-logic changes (for the owner of docs/business-logic.md)
- §1.1 API: `GET /api/products/{id}` adds `suppliers[{id,code,name}]` (suppliers of COMPLETED receipts containing the product, latest `received_at` first; cancelled receipts and drafts excluded) and `stocks[].expectedOutDays` (same formula as the list, stock and 30-day net sales per branch; null when net sales ≤ 0) (`PS/product/ProductDetailInsightRepository.java`, `PS/product/ProductDetailQuery.java`).
- §1.1 list: each item adds `units[{code,unitName,conversionRate,price}]`, all units with the base unit first (`PS/product/ProductListRepository.java`). The frontend row unit switcher shows cost×rate and stock÷rate (`FE/features/products/product-list-table.tsx`). `otherUnits` is kept.
- §1.1 frontend: product detail footer is Xóa, Sao chép | Chỉnh sửa, In tem mã, "…" (Ngừng/Cho phép KD) (`FE/features/products/product-detail-panel.tsx`). Sao chép = create form without ids, codes, barcodes or cost (`FE/features/products/product-form-state.ts` `copyFormFromDetail`).
- New "In tem mã": Code 128-B labels (barcode if set, else unit code), 2 columns of 62×30 mm, at most 500 labels per print (`FE/features/print/barcode-code128.ts`, `FE/features/print/barcode-label-print.ts`). Receipt labels use ceil(qty) copies per line and the unit's general price.
- §1.9 receipt detail: "Thiết lập giá" header link plus a per-line tag → `/products/price-books?code=` (`FE/features/purchases/receipt-lines-table.tsx`). Sao chép is now in "…" (`FE/features/purchases/receipt-detail-panel.tsx`).
- §1.6: price-books page deep link `?code=` pre-fills "Tìm mã hàng" (`FE/app/(admin)/products/price-books/page.tsx`).
- §2.5 invoice detail: a PUBLISHED e-invoice hides Sao chép / Xuất file / In. "…" adds Xem hóa đơn điện tử and Cách tra cứu (`FE/features/sales/invoice-detail-footer.tsx`, `FE/features/sales/invoice-einvoice-howto-dialog.tsx`). The buyer line is name / address / phone (`FE/features/sales/invoice-einvoice-card.tsx`).
- §4.14/4.15: route guard. Paths under /products, /inventory, /purchases (catalog.view / inventory.view), /invoices, /orders, /returns, /delivery (sales.perform), /customers (patient.view), /employees (hr.manage), /cashbook (cashbook.manage), /reports, /accounting (report.view) redirect to `/` with the toast when the permission is missing. The page does not render until `/auth/me` loads (`FE/components/layout/route-permission-guard.tsx`).

## Verification
- `mvn -q -pl product-service -am package` OK. `tsc --noEmit` OK. eslint on changed files clean. `next build` OK, restarted :3010.
- New `scratchpad/e2e_parity_product_detail.py` 7/7. It purges its own data.
- e2e_purchasing 21/21, e2e_suppliers 59/59, e2e_invoice_tools 27/27.
- e2e_products 10/16: it assumes an empty DB (expects SP000001, total=2). It fails the same way without these changes. Test 1's diff is only codes, not the new keys.
- Playwright `scratchpad/parity/pw_parity_check.py`: product supplier box, footer, unit switch (SP000112 → SP000113), Tồn kho column, copy prefill, receipt links/footer, price-books `?code=`, invoice footer (non-e-invoiced), no JS errors, and the no-permission redirect + toast with a temporary CASHIER user. Screenshots are in `scratchpad/parity/shots/`. The first run's only FAIL was the "Thiết lập giá" link count, caused by the same href in the nav menu; I fixed the selector and checked the screenshot.

## Concerns / unresolved
- There are no `einvoice_records` in the DB, so the e-invoiced footer branch was type-checked only, not seen in a browser.
- Test data left behind:
  - e2e_products (2 runs) and e2e_purchasing (1 run) left test products. I deactivated them through the API. A SQL purge was blocked by the permission classifier: SP000128/130/131/135/137/138, SP000132/134, categories "Vắc xin cúm" ×2, supplier NCC000022.
  - A locked user `e2e_parity_1f7295` remains from the guard check. Users cannot be deleted.
- Should a cost-view permission (hide cost columns, mask supplier phone) be added? It touches identity Permissions + role seeds + product-service DTOs, which the audit agent's permission work owns.
- KiotViet's supplier list hides Điện thoại by default. Should ours?
