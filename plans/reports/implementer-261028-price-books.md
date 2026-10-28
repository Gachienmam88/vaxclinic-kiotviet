# Thiết lập giá (bảng giá) — implementation report (2026-10-28)

## Backend (product-service, package `com.vaxclinic.product.pricebook`)
- `V5__price_books.sql`: `price_books` (name unique by lower(name), valid_from < valid_to CHECK, active, scopes `branch_ids` / `customer_group_ids` / `seller_ids` uuid[] where NULL = all, `missing_policy` ALLOW|BLOCK|WARN, auto_update + auto_op/value/percent, created_by*), `price_book_items` (PK book+unit, price >= 0 CHECK, FK cascade on book and unit).
- SQL fn `price_book_formula(base, op, val, pct)`: round to VND, floor 0. Trigger `trg_product_units_price_books` on `product_units.price` update recomputes items in books with auto_update, so every write path is covered and ProductCommandService is unchanged.
- Files: `PriceBookDtos`, `PriceBookService` (CRUD + validation; save with autoUpdate on recomputes existing items right away), `PriceBookRowQuery` (matrix rows; FROM/WHERE shared with the formula), `PriceBookItemService` (upsert/delete, formula, import), `PriceBookController`, `PosPriceBookQuery`. `ProductController` changed only for pos-catalog.
- Per-unit costs: Giá vốn = products.cost x conversion_rate. Giá nhập cuối = unit_price - discount from the latest COMPLETED purchase receipt line for that unit.
- Permissions: `catalog.view` to read, `catalog.manage` to write. AuditLogger feature "Thiết lập giá" logs Tạo / Sửa / Xóa / Sửa giá / Áp dụng công thức / Nhập file.

## Routes
| Method | Path | Notes |
|---|---|---|
| GET | /api/price-books | list (with itemCount) |
| GET/PUT/DELETE | /api/price-books/{id} | |
| POST | /api/price-books | 201; 409 `PRICE_BOOK_NAME_DUPLICATE`, 400 `PRICE_BOOK_VALIDITY` / `PRICE_BOOK_SCOPE` (empty list) |
| GET | /api/price-books/items?bookIds=..&q&categoryIds&stock&branchId&inBookOnly&page&size | matrix: unitId, code, name, unitName, cost, lastPurchasePrice, basePrice, prices{bookId: price} |
| GET | /api/price-books/{id}/items | same, inBookOnly=true by default |
| PUT | /api/price-books/{id}/items | `{items:[{unitId, price\|null}]}`; null = remove from book |
| POST | /api/price-books/{id}/items/apply-formula | `{base: BASE_PRICE\|COST\|LAST_PURCHASE\|BOOK, baseBookId, op: PLUS\|MINUS, value, percent, onlyExisting, q, categoryIds, stock, branchId}`. Runs on every row in the filter, not only the page shown. Rows with no base value are skipped. |
| POST | /api/price-books/{id}/items/import | `{rows:[{line, code, price}]}` gives `{updated, errors:[{line, code, message}]}`. Valid rows are saved; code match ignores case. |
| GET | /api/products/pos-catalog?branchId=X&withPriceBooks=true | `{products, priceBooks}`. Without the flag it returns the same array as before, so callers are unaffected. |

POS `priceBooks[]` = `{id, name, validFrom, validTo, branchIds, customerGroupIds, sellerIds, missingPolicy, prices{unitId: price}}`. It holds only books with status Áp dụng, valid_to > now and a branch scope that covers X. Books that start in the future are included; the client checks dates.

## Gateway
`/api/price-books/**` appended to the `product` route in `backend/gateway-service/src/main/resources/application.yml` (not restarted).

## Frontend
- Page `/products/price-books` (`app/(admin)/products/price-books/page.tsx`): PurchaseListLayout/Pager, search "Theo mã, tên hàng", Nhập file, Xuất file.
- `features/products/`:
  - `price-book-types.ts`, `price-book-queries.ts`
  - `price-book-sidebar.tsx`: book checklist with + and a pencil per book, "Chỉ hàng có trong bảng giá", Nhóm hàng, Tồn kho
  - `price-book-table.tsx`: columns Mã hàng, Tên hàng (ĐVT), Giá vốn, Giá nhập cuối, Giá chung, then one column per selected book. The header menu has Áp dụng công thức / Nhập file giá / Sửa bảng giá.
  - `price-book-price-cell.tsx`: inline edit. Enter or blur saves, Esc cancels, empty + Enter removes the item. The Giá chung placeholder is shown in muted text.
  - `price-book-form-dialog.tsx` + `price-book-scope-picker.tsx`: Thêm/Sửa bảng giá, Xóa, scope Tất cả / Chọn
  - `price-book-formula-dialog.tsx`, `price-book-import.tsx`, `price-book-csv.ts`
  - `price-book-resolver.ts`
- Customer groups come from `/customer-groups` (sales-service). If that call fails, the picker is disabled and shows the error. No fallback data.
- Menu link NOT added (app-header-nav-menu.tsx is off-limits). Lead should add "Thiết lập giá" under Hàng hóa, pointing to `/products/price-books`.

## POS wiring (lead; features/pos untouched)
1. `use-pos-catalog.ts`: fetch `/products/pos-catalog?branchId=${branchId}&withPriceBooks=true` and cache `{products, priceBooks}`. Read `products` as today and store `priceBooks: CatalogPriceBook[]` next to it in the offline cache.
2. Add a "Bảng giá" select to the POS header. Options: "Bảng giá chung" (null) + `applicablePriceBooks(priceBooks, {branchId, customerGroupId, sellerId, date: new Date()})`. Re-filter when customer or seller changes. If the chosen book drops out of the list, reset to null, or keep it and let the resolver warn.
3. When adding a line or changing book/customer/seller: `resolvePrice(priceBooks, {...ctx, bookId}, unit.id, unit.price)`.
   - `allowed === false`: refuse to add the line and toast the `warning`.
   - `warning` set: add the line and toast the warning.
   - otherwise use `price`.
   When the book changes, re-price the existing lines unless the cashier edited the price by hand.
4. Optionally store `priceBookId` on the invoice line or header for reports. That is not done yet and needs sales-service fields.

## Tests
- E2E `scratchpad/e2e_price_books.py` against :8082 with an admin JWT: 40/40 pass. Covers:
  - 401 without a token
  - CRUD and validation: duplicate name (case-insensitive) and rename to an existing name, dates, empty scope, negative auto value, blank name
  - scopes stored correctly
  - upsert, remove, negative price, unknown unit
  - matrix cost per unit, base price, prices map, inBookOnly
  - formula: Giá chung -10%; other book +5000 with onlyExisting; Giá vốn +20%; Giá nhập cuối skip; clamp at 0; BOOK without baseBookId gives 400
  - CSV import: 2 ok + 4 line errors
  - auto-update: on enable, and the trigger after a product PUT; non-auto book unchanged
  - POS: legacy array unchanged; `withPriceBooks` carries scopes, policy and prices; books excluded for another branch, Chưa áp dụng status, or expiry
  - cleanup: books deleted (404), test product soft-deleted
- Resolver: `scratchpad/price-book-resolver.test.ts` (`node --experimental-strip-types --test`), 5/5 pass.
- `tsc --noEmit` clean. eslint clean on all new files. product-service rebuilt and running on :8082.

## Unresolved questions
- Hiệu lực uses date-only pickers (from = 00:00, to = 23:59:59 local). KiotViet also allows a time of day.
- The resolver takes one `customerGroupId`. If a customer can belong to several groups, the signature should take a list.
- Auto-update only reprices items already in the book. Products created later are not added automatically.
- Selected books are not persisted across reloads.
