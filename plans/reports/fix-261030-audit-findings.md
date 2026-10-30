# Fix audit findings: report (261030)

**Status: DONE.** All 13 findings plus the 3 approved follow-ups are fixed and committed on `feature/phase-01-foundation` (not pushed). The full e2e/smoke run is complete and green (see Tests).

E2E scripts live in `C:\Users\chipc\AppData\Local\Temp\claude\C--Users-chipc-Desktop-kiot-viet-clone\a238b785-acf8-44ef-bf0d-f8ed0a62f4a4\scratchpad\`, as `e2e_audit_*.py` plus the shared cleanup helper `e2e_audit_kit.py`. Each script cleans up only its own rows and ends with "remaining test rows = 0".

## Items

| # | Commit | What changed | E2E |
|---|---|---|---|
| 1 Logout | 6acc202 | `/api/auth/logout` is public in gateway + identity; the refresh token in the body authorises it. The live token row is deleted rather than flagged, so a stale tab re-sending it gets 401 and doesn't trip the reuse alarm (which revokes all sessions). | logout 5/5 |
| 4 Rate limit + headers | f6da541 | Gateway `RateLimitFilter` token bucket: login/2FA 20/min/IP, refresh/logout 60/min/IP, general 900/min per user (per IP when anonymous). Returns 429 `RATE_LIMITED` + Retry-After. XFF is trusted only from loopback/private addresses. The BFF forwards the browser IP. Next.js sends CSP, XFO SAMEORIGIN, nosniff and Referrer-Policy; HSTS is set in middleware only with https + secure cookies. | security 9/9 (66 pages, no CSP violation, print iframe OK) |
| 5 Role defaults | e4836bb | identity `V11` seeds only system roles that have no permissions. Mapping is in business-logic §4.3. MANAGER: everything except user/branch/settings. RECEPTIONIST: catalog.view, patient.view/manage, reception. DOCTOR: catalog.view, patient.view, screening. NURSE: catalog.view, inventory.view, patient.view, injection. CASHIER: catalog.view, patient.view/manage, sales.perform. STOREKEEPER: catalog.view, inventory.view/manage. | roles 7/7 (rollback transaction) |
| 6 Stock-out days | 08a102f | Net sales count SALE, SALE_CANCEL, SALE_RETURN, SALE_RETURN_CANCEL_OUT. | stockout 4/4 |
| 7 Ledger date | d231b48 | Ledger rows take the document date: receipts and returns, stock issues, and their cancels (cancels on the same date). `stock_ledger.seq` added (product `V10`). Back-dated rows trigger a recompute of `balance_after` per product × branch. Editing `received_at` re-dates the ledger rows, the PC supplier doc and the cashbook voucher (outbox UPDATE). | backdate 5/5 |
| 8 Cost lock | 90e5997 | Product row locked with `SELECT … FOR NO KEY UPDATE` (FOR UPDATE deadlocked on FK key-share locks) and reloaded. The average uses shop-wide stock. | cost 2/2 (6 concurrent receipts) |
| 9 Purchase-return refund | 4ac8ddd | refund > 0 → outbox receipt `PT{THN}` ("Thu Tiền NCC hoàn trả", accounting=false) plus a supplier debt doc `kind=REFUND` (+refund); the return itself posts −total. Cancelling the return reverses both. REFUND docs are read-only (`SUPPLIER_DOC_AUTO`). Product `V11` backfills old returns. | purchase_refund 5/5 |
| 10 HR expenses | eb9e753 | Inbound PAYROLL / HR_ADVANCE vouchers are saved with accounting=true. The finance-report salary filter is source-based plus "lương". Sales `V22` backfills existing rows and extends the unique source index. | hr_expense 4/4 |
| 2 Branch scope | 3e95cb4 | Common `BranchScope`: lists, books and reports are limited to the JWT `branches` claim; an explicit branch outside it → 403 `BRANCH_FORBIDDEN`. Covers products stock, purchase receipts/returns, stock takes/issues, S2d, invoices (+ export, dashboard), returns (+ branchId filter), orders (+ export), revenue book, customer debt report (each entry mapped to its doc's branch, else the customer's branch), and all report filters (which used to silently drop the branch, now 403). | branch_scope 8/8 |
| 3 Permissions | d715b6e | `GET /cashbook/{id}` (cashbook.manage / report.view / sales.perform), `/cashbook/categories` (cashbook.manage / report.view), bank accounts + VietQR (cashbook.manage / sales.perform / inventory.manage / report.view). `PATCH /tax-codes`: status, branch, BOOK_LOCKED, published e-invoice. `PATCH /info`: branch. | permissions 5/5 |
| + Order merge | 5b88092 | POST `/orders/merge` re-checks the invoicing claim on the server. | order_merge 3/3 |
| 11 Return fee | 1fc7e46 | Revenue book (dashboard) and seller revenue value returns at subtotal − discount; new `returnFee` column. Net revenue no longer includes the fee anywhere. The HKD S1a book and tax declaration add the fee back as taxable income, so tax is unchanged. | return_fee 3/3, e2e_reports 39/39 |
| 12 Invoice merge | fe451b2 | Totals + tax reduction + per-line `tax_reduced` are recomputed on the server; prescription and e-invoice buyer are copied. A mismatch → `MERGE_ATTRIBUTES_DIFFER`; paid > recomputed total → 409 `MERGE_TOTAL_CHANGED`. | invoice_merge 2/2 |
| 13 E-invoice buyer | 8797dbb | `/internal/invoices/{id}` overlays the invoice's buyer info field by field over the customer profile. Unit test `InternalInvoiceBuyerTest`. | einvoice_buyer 3/3, sales unit tests 40/40 |

Other commits:
- Orders docs (26fd7a0, 638d856) and parity docs (5a6bb53).
- Broken report pages: customers/employees/channels are now client pages (2c61048).
- i18n for the new error codes in vi/en/zh/ja (a13f53d).

## Tests

- **Per item:** each audit e2e above passed after its fix. Regressions also passed: login_flow, offline_sync, purchasing 21/21, inventory_docs 50/50, suppliers 59/59, sales 22/22, invoice_tools 27/27, delivery 71/71, orders_groups 34/34, hr 85/85, reports 39/39, smoke_product 63/63, smoke_sales 49/49.
- **Full run (after the coordinator's DB cleanup):** every `e2e_*.py` / `smoke_*.py` ran one at a time. All passed, including e2e_products 16/16 now that the DB is clean. Per-script results are in scratchpad `full_run.txt`.
  - `e2e_reports_checks.py` and `e2e_reports_supplier_discount.py` exit with NameError when run alone. They are exec'd by `e2e_reports.py` (39/39), not standalone suites.
- **Incidents during the run:**
  - `e2e_audit_security` failed once on a terms-of-use dialog: the clean DB has admin terms un-accepted. Fixed by having the test accept the terms temporarily and restore them; then 9/9.
  - My batch timeout killed `e2e_store_profile` mid-run, which left admin 2FA on and the store settings changed. I restored them by hand from `backups/261030-before-selective-test-cleanup`, then re-ran it in full: 66/66, settings restored.
- **Test updates:** these changed because the spec changed, not to weaken them:
  - e2e_reports E25 and F3: an out-of-scope branch now gives 403.
  - e2e_reports E9 and E18: the fee is now separate from net revenue.
  - smoke_product: added the `productCount` key.
- e2e_products (expects an empty DB, codes from SP000001) failed on the old dirty data; after the coordinator's cleanup it passes 16/16.

## Approved follow-ups

| Follow-up | Commit | What changed | E2E |
|---|---|---|---|
| Published e-invoice blocks tax-code edits | 6a9291e | `SalesRules.checkEInvoiceNeverPublished`: PATCH /tax-codes always → 400 `EINVOICE_PUBLISHED` when the e-invoice is published, regardless of the setting. Edit/cancel still follow the setting. | taxcode_einvoice 2/2 |
| paymentDiscount branch-scoped | fe93a23 | `customer_debt_ledger.branch_id` (sales `V23`, NOT NULL, indexed). Backfill order: source doc (invoice / return / voucher / order / shipment), then customer branch, then CN001. Dev backfill: 49/49 rows came from the source doc; 0 used the customer or default branch. `DebtLedger.post` now takes the branch at every call site. The finance report filters paymentDiscount by branch. | debt_branch 2/2 |
| Login lockout by real client IP | d019622 | Identity `ClientIpResolver` uses the first XFF entry only from a loopback/private peer, otherwise the TCP address (same rule as the gateway). The gateway overwrites XFF for untrusted peers. Unit tests added; the old "last entry" test was updated to the approved rule. | login_ip 2/2 (5 bad logins from A lock A, not B), hardening 25/25 |

| Customer-debt writes branch-scoped | 3f2a93f | `DebtService.checkBranchScope`: payment / discount use the request `branchId`; adjustment uses the customer's branch (null → CN001). Outside the JWT branches → 403 `BRANCH_FORBIDDEN` (payment used to return 400 BRANCH_NOT_ALLOWED; discount and adjustment were unchecked). | debt_write_scope 2/2, e2e_sales 22/22, debt_branch 2/2 |

Also:
- `e2e_sales.py` now tags its data and deletes it at exit. It creates a category itself when none exists.
- The remaining Typhim / Thorman rows are SP000020 / NCC000005, which the coordinator kept.

## Decisions

- Access JWTs stay stateless and valid up to 30 min after logout (no denylist).
- The gateway trusts XFF only from private/loopback addresses. Without a reverse proxy, a browser can spoof XFF to Next.js; the per-username lockout in identity still applies.
- Rate limits are per gateway instance (in RAM).
- Ledger: cancels are dated at the document date. The cost on a back-dated row is the cost at posting time. The negative-stock check uses current stock.
- Sales-service stock docs are still posted at call time.
- Branch scope = the JWT `branches` claim, so a user assigned to every branch sees the whole shop. An admin not assigned to a new branch can't see it until they're added to it.
- Return fee: excluded from net revenue but kept in HKD taxable revenue, so tax amounts don't change.
- Invoice tax-code edit blocks after e-invoice issue only when "block edit of published invoice" is on, same as edit and cancel.
- Merged-invoice debt: SALE_CANCEL is posted per original plus SALE for the new total. `customers.total_sales` is not adjusted for rounding.

## Unresolved questions

- (Answered and done: the 3 follow-ups above.)
- (Answered and done: customer-debt writes are now branch-scoped — see below.)
