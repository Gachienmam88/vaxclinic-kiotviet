# Thiết lập giá – KiotViet parity + lọc "Dự kiến hết hàng" (2026-10-29)

Commit: `1318cfd feat(price-books): ...` (+ auto-commits from hook). Branch `feature/phase-01-foundation`, not pushed.

## Backend (product-service)
- `PUT /api/price-books/base-prices` – edit Bảng giá chung (product_units.price); existing trigger keeps auto books in sync.
- `POST /api/price-books/base-prices/apply-formula` – formula on Bảng giá chung column.
- `FormulaRequest` + `unitIds` (null = all rows in filter, `[id]` = this row), new base `CURRENT` (Giá hiện tại of the target column), + compare/code/name filters so "apply to all" respects current filters.
- `RowFilter` + `priceOp` (LT/LTE/EQ/GTE/GT), `compareWith` (COST/LAST_PURCHASE), `compareBookId` (null = giá chung), `code`, `name`. Matrix params of same names.
- Price book formula: V9 migration adds `auto_base`, `auto_base_book_id`. Reuses existing autoOp/autoValue/autoPercent + `applyFormula` SQL: create → fills all rows with a base value; update → recomputes rows already in the book (replaces old `recalculateItems`). `auto_update` (trigger) stored only when base = Bảng giá chung. Legacy books (auto_update, no base) treated as base = giá chung.
- `GET /api/categories` returns `productCount` (non-deleted products directly in group).
- `GET /api/products?expectedOutFrom=yyyy-mm-dd&expectedOutTo=...` – expected-out subquery moved to a lateral join; date = today (Asia/Ho_Chi_Minh) + days; null days excluded when filtering.

## Frontend
- Page: title = selected column names; toolbar search, `+ Bảng giá`, Import, Xuất file; default chip "Bảng giá chung".
- Sidebar: chip multi-select (`price-book-chip-select.tsx`) + "Tạo mới"; Nhóm hàng popover picker (`category-picker-popover.tsx`, search, "Tên (n)", Chọn tất cả / Áp dụng); Tồn kho; Giá bán (Chọn điều kiện / Chọn giá so sánh).
- Table: Mã hàng, Tên hàng, Giá vốn, Giá nhập cuối + one bordered input column per chip (incl. Bảng giá chung); header row "Tìm mã hàng" / "Tìm tên hàng".
- Price cell focus → "Hoặc sử dụng Công thức" → `price-book-formula-popover.tsx` (renamed from formula-dialog): preview "Giá mới [x]", base select, round +/− toggles, VND/% segment, "Áp dụng ... cho tất cả N hàng hóa trong <tên>", Bỏ qua / Xong.
- Create/edit dialog: tabs Thông tin (Hiệu lực datetime + Trạng thái, Công thức giá, Khi thu ngân lên đơn → ALLOW/WARN/BLOCK) / Phạm vi áp dụng (3 cards, "cụ thể" reveals multi-select). Shared `price-book-formula-inputs.tsx`.
- Products sidebar: "Dự kiến hết hàng" (Toàn thời gian / Tùy chỉnh + range, mirrors Thời gian tạo).
- i18n vi/en/zh/ja updated; orphaned keys (old dialog, missingPolicy labels) removed.

## Verification
- `mvn -q -pl product-service -am package` OK (tests pass).
- `npx tsc --noEmit` clean, eslint clean on changed files, `tests/i18n-keys.test.mjs` 25/25.
- e2e `e2e_price_books.py`: 68/68 pass. New checks in `scratchpad/e2e_price_books_parity_checks.py` (imported by main script): base price edit (+ auto book follows), single-row formula (book + base, CURRENT base), all-rows base formula from other book, compare filter (GT/LT/EQ on book/LAST_PURCHASE/ignored without compareWith), code/name filters, create-with-formula (COST, other BOOK, BASE_PRICE keeps autoUpdate), invalid bases → 400, edit recompute, category productCount, expected-out filter (wide range, no-sales excluded, exact day, before-earliest = 0). Demo data kept.
- All services listening; product-service health UP.

## Unresolved / concerns
- :3010 runs `next start` (production build), not dev → new UI is NOT visible until `next build` + restart. My attempt (stop frontend + build) was blocked by the permission classifier; frontend left running old build. UI therefore not visually verified against screenshots.
- Kept "Chỉ hàng có trong bảng giá" checkbox (shown only when a real book chip is selected) – not in KiotViet screenshot; remove if exact parity wanted.
- Column header dropdown on book columns now only Import / Sửa (bulk formula moved to popover checkbox).
- "Apply to all" with inBookOnly on: base column ignores the in-book restriction; book column restricts to that book only (display restricts to any selected book) – edge-case mismatch of N.
- Formula base "other book" preview shows `---` when that book is not a selected column (prices not loaded); server still applies correctly.
