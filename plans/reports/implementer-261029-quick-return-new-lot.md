# Implementer report: Trả nhanh nhập lô mới (2026-10-29)

## Behaviour
- Trả nhanh, hàng theo lô: chọn lô có sẵn tại chi nhánh HOẶC "+ Nhập lô mới" (số lô + HSD qua DatePicker dd/MM/yyyy). Stock return creates the lot at the branch with the HSD you entered.
- Typed lot already exists at branch (product + branch + lot number): reused. If the HSD sent differs from the lot's HSD → 400 `LOT_EXPIRY_MISMATCH` "{hàng}: lô X đã có tại chi nhánh với hạn sử dụng dd/MM/yyyy, không khớp hạn đã nhập dd/MM/yyyy". This check runs even when the lot quantity is 0, which is stricter than StockMovementService (it only checks when qty > 0). Sending no HSD for an existing lot still works, as before.
- New lot without HSD → 400 `EXPIRY_REQUIRED` "Lô X chưa có tại chi nhánh — nhập hạn sử dụng để tạo lô mới". This replaces the old `LOT_NOT_FOUND`; the frontend never used that code.
- HSD in the past: backend accepts it. The UI shows an amber warning ("nên xuất hủy sau khi nhận lại").
- Cost = the product's current cost × conversion rate (rule unchanged). Ledger doc type is still SALE_RETURN. Idempotent by return id (unchanged). Cancelling a return takes the qty back out of the new lot.
- Non-lot products: unchanged. Any lot/HSD sent for them is ignored.
- Product form: `emptyProductForm` already had `lotManaged: false`, and backend/DB default is false too. **No change needed.** Existing products and the copy path (formFromDetail) are untouched.
- Khóa sổ / permissions / branch check / audit: same QuickReturnService path, nothing changed.

## Files
Backend (product-service)
- `backend/product-service/src/main/java/com/vaxclinic/product/internal/InternalStockService.java`: LineInput + `expiryDate`; saleReturn passes the resolved HSD to the movement and the result allocation (lot trimmed). 213 lines (was 203).
- NEW `backend/product-service/src/main/java/com/vaxclinic/product/internal/SaleReturnLotExpiryResolver.java`: existing lot → its HSD (mismatch → 400); new lot → HSD from the request.

Backend (sales-service)
- `backend/sales-service/src/main/java/com/vaxclinic/sales/invoice/ProductStockClient.java`: Line + `expiryDate`, plus a 6-arg back-compat ctor (SalesReturnService is unchanged).
- `backend/sales-service/src/main/java/com/vaxclinic/sales/salesreturn/QuickReturnService.java`: sends `expiryDate` for lot lines; new EXPIRY_REQUIRED message; doc comment.
- `backend/sales-service/src/main/java/com/vaxclinic/sales/salesreturn/SalesReturnDtos.java`: doc comment only.
- Lead's `accounting/SellerRevenueInternalController.java` kept as-is and included in the build.

Frontend
- `frontend/src/features/sale/sale-quick-return-lot.tsx`: select gets a "+ Nhập lô mới" option → lot number input + DatePicker + "Chọn lô có sẵn". Hints: typed lot already exists (reuse) / HSD mismatch (red) / expired (amber).
- `frontend/src/features/sale/sale-types.ts`: CartLine `lotExpiry` ("" = new lot without HSD yet, null = existing lot).
- `frontend/src/features/sale/sale-cart.tsx`: wiring.
- `frontend/src/features/sale/use-sale-return-submit.ts`: body `expiryDate`, trimmed lot. Validation: "chọn lô hàng trả hoặc nhập lô mới" / "nhập hạn sử dụng cho lô mới".

## Builds / validation
- product-service, then sales-service: `mvn -q -o -pl <m> -am package -DskipTests` OK, one at a time. No other mvn was running, and each service was stopped first. Restarted with start-all-local.ps1; both health checks 200.
- `npx tsc --noEmit -p .`: clean. eslint on the 4 changed files: clean.

## Tests (scratchpad)
- `e2e_sale_backend.py`: **57/57**. #26 now expects EXPIRY_REQUIRED. New `e2e_sale_backend_new_lot.py` (#48–57):
  - new lot is created with its HSD and stock goes up
  - SALE_RETURN ledger row; cost 200k
  - **/internal/seller-revenue goes down 540k for the quick-return creator** (internal JWT is signed in-script from JWT_SECRET and never printed)
  - idempotent retry
  - reuse of the same lot + same HSD
  - HSD mismatch on a new lot and on existing lot GH1 → 400
  - expired HSD is accepted
  - non-lot product is unchanged and gets no lot
  - cancel takes the new lot back down

  The cleanup now always hard-deletes the test products, quick returns, and external_stock_docs.
- `e2e_edit_return.py` (invoice-based return path): 18/18. Its data was removed in the cleanup below.
- e2e_hr.py was not run; the focused commission check covers it.

## Cleanup (DB now: sales_db only sales_channels seed; product_db only tax_rates)
sales_db:
- invoices HD000088/89/90/102/103/115 + lines/lot rows/allocations
- returns TH000022/TH000035 + lines
- customers KH000024/33 "Khách test sửa trả", KH000025/29 "Ngô Minh Khải" + 36 debt rows
- 14 vouchers (TT/PC/PT of those docs, PC000005/06 "Xe ôm", PCPN000011/12)
- 2 inactive VietinBank 88875668 bank accounts

product_db:
- 12 test products: "Vắc xin test sửa/trả" ×2, "Typhim Vi (test bán)" ×2, "test giao hàng/trả nhanh e4bd29", "E2E Giá e053e9", "Vắc xin thử thông báo 2129xx/2131xx" ×5
- their units, lots, balances, ledger
- categories "Nhóm test sửa trả" + "Test TB 212955/213044/213108/213150/213185"
- suppliers NCC000007/08 THORMAN + PN000011/12 + supplier debt docs/allocations
- 5 PURCHASE outbox rows
- 140 external_stock_docs (all created 17:33–18:57 UTC by the test runs)

Not deleted:
- sales channel CH007 "Shopee 114d25" (inactive): created 2026-10-28 21:16 VN, so not from 10-29
- audit logs
- notification-side rows from the notifications agent's tests
- sequence counters

Cleanup SQL: scratchpad `cleanup_test_rows_261029_sales.sql`, `cleanup_test_rows_261029_product.sql`.

**Status:** DONE_WITH_CONCERNS
**Summary:** Quick return now accepts a new lot + HSD, which creates the lot at the branch; an existing lot is reused and a different HSD gives 400. Backend and frontend are done, and the commission deduction is verified. Test data is cleaned.
**Concerns:**
- "Test TB"/"thử thông báo" rows belonged to the notifications agent's tests (inactive, created 18:42–18:46 UTC); they are deleted, so tell that agent if it relies on them.
- InternalStockService is 213 lines.

## Unresolved questions
- If a typed lot exists but has qty 0 and a different HSD, it is currently rejected (strict). Should the HSD be overwritten instead?
