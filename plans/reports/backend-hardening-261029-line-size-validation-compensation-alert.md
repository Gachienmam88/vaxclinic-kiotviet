# Checkout follow-ups: line length validation + "hoàn kho" inbox alert

- Date: 2026-10-29 · Follow-up to `backend-hardening-261029-timeouts-checkout-login-search.md`, concerns 1 and 4
- Status: **DONE**

## 1. Length validation before stock is touched
Column lengths checked in the sales migrations: `invoice_lines` (V1), `customer_order_lines` (V7) and `sales_return_lines` (V3) all use product_code 50, product_name 250, unit_name 50.
- `InvoiceDtos.LineInput` is shared by invoices, orders and invoices created from orders. It now has:
  - `@Size(max=50, "Mã hàng tối đa 50 ký tự")`
  - `@Size(max=250, "Tên hàng tối đa 250 ký tự")`
  - `@Size(max=50, "Đơn vị tính tối đa 50 ký tự")`
- Every entry point already uses `@Valid @RequestBody`: POST/PUT `/api/invoices`, POST/PUT `/api/orders`, `/api/orders/{id}/invoice`. Oversize input now returns 400 `VALIDATION_FAILED` before `checkouts.begin` or the stock call.
- I checked the rest of the checkout path and found no other gap:
  - `InvoiceRequest`: sellerName 150 = 150; priceBookName 150 = 150; salesChannel 30 = 30; note and line `lots` are TEXT; line note 500 = 500; line taxCode 30 = 30.
  - `EInvoiceBuyer` already matches V13 (200/250/20/500/150/20).
  - `DeliveryInput` matches `shipments` (200/20/300/150; note is TEXT).
  - The customer name snapshot comes from the `customers` row (200 → 200); the API does not accept it.
  - `checkout_attempts.partner_name` 200 comes from the customer name, and doc_code 30 is server-generated.
  - Returns: `SalesReturnDtos.LineInput` has no code/name/unit fields. By-invoice returns copy them from invoice_lines. Quick returns take them from the product-service catalog, whose limits are the same (products.code 50, name 250, unit_name 50). lotNumber 50 = 50.

## 2. Inbox alert when the reconciler reverses stock
- New `sales/invoice/checkout/CheckoutCompensationNotifier` (uses the common-lib `NotificationClient.publish`, the event-style path like `SEPAY_RECEIVED`):
  - type `CHECKOUT_COMPENSATED`, permission `sales.perform`, branchId = the attempt's branch
  - dedupeKey `checkout_compensated:{attemptId}:{round}`: a re-send creates no duplicate, and a second compensation after a POS retry counts as a new event
  - docCode/link are null: there is no invoice, and the attempt does not keep product ids, so there is no stock card to link to
  - title: `Thanh toán {HD code}[ - {customer}] không lưu được hóa đơn, đã hoàn kho`
  - body as specified: `Lần thanh toán {first 8 chars of the id} lúc HH:mm dd/MM/yyyy không lưu được hóa đơn — đã hoàn kho tự động. Kiểm tra lại với thu ngân.` The time is the attempt's `updated_at` (the POS's last submit) in the shop zone.
- It is never part of a `sync` type list, so identity never auto-resolves it. It is shown under the "Cảnh báo" tab (category ALERT, TriangleAlert icon), and the frontend needed no change.
- `CheckoutReconciler`: notifies only when SALE_CANCEL actually reversed stock. The `STOCK_DOC_NOT_FOUND` case (nothing was deducted) is still marked COMPENSATED but sends no alert. The alert is sent after the COMPENSATED commit. A send failure is only logged by NotificationClient, and compensation is not affected.

## Tests
- Unit (`mvn -q -o -pl sales-service -am package`, EXIT 0):
  - `CheckoutCompensationFlowTest`, 4 tests (+1): checks the published item's type, key, branch, permission, null docCode and body format; nothing is published for FAILED; no alert when nothing was deducted.
  - New `InvoiceLineInputValidationTest` (2): 50/250/50 accepted; 51/251/51 rejected with the 3 Vietnamese messages.
  - Other sales tests: all pass.
- e2e (services restarted with `scripts/start-all-local.ps1`):
  - `e2e_hardening.py`: **25/25** (full run, reconciler wait included; A1–A8 + new A0, A5b). The persist failure is now forced by a temporary trigger `e2e_fail_invoice_{tag}`: BEFORE INSERT on `invoices`, it raises only when note = `E2E_FORCE_PERSIST_FAIL_{tag}`, so no other invoice is affected. The test creates it via psql in docker and drops it at exit (cleanup prints the remaining count). Retries send `note: null`. New checks:
    - A0: oversize code/name/unit returns 400 VALIDATION_FAILED, stock is unchanged and no attempt row is created.
    - A5b: exactly one `CHECKOUT_COMPENSATED` notification with sales.perform, the branch and the expected body.
    - Cleanup also deletes the test notifications.
  - `e2e_sales.py` 22/22, `e2e_sale_backend.py` 57/57, `e2e_notifications.py` ALL PASSED.

- Cleanup was verified: 0 test notifications, 0 e2e triggers/functions, 0 test checkout_attempts. `e2e_sales.py` left 1 orphan FAILED attempt (insufficient-stock case, it does not use the kit cleanup). I deleted it by hand; the script still needs fixing.

## Files
- M `backend/sales-service/src/main/java/com/vaxclinic/sales/invoice/InvoiceDtos.java`
- M `backend/sales-service/src/main/java/com/vaxclinic/sales/invoice/checkout/CheckoutReconciler.java` (102 lines)
- A `backend/sales-service/src/main/java/com/vaxclinic/sales/invoice/checkout/CheckoutCompensationNotifier.java`
- M `backend/sales-service/src/test/java/com/vaxclinic/sales/invoice/checkout/CheckoutCompensationFlowTest.java` (178 lines)
- A `backend/sales-service/src/test/java/com/vaxclinic/sales/invoice/InvoiceLineInputValidationTest.java`
- M scratchpad `e2e_hardening.py` (backup `e2e_hardening.py.bak`)

## Concerns / open questions
1. The alert is best-effort: if identity is down at that moment, it is lost (only logged), while the attempt stays COMPENSATED. A `notified_at` column with retries would fix this. Not done (YAGNI).
2. `e2e_sales.py` does not delete its `checkout_attempts` row (FAILED, insufficient-stock test), so each run leaves 1 orphan. It needs a cleanup line like the one in `e2e_delivery_kit.cleanup`.
3. The alert has no link. Linking to a product stock card would need the attempt to store its product ids (only a text `summary` is kept today).
