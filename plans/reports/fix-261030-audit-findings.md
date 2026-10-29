# Fix audit findings: report (261030)

**Status: DONE_WITH_CONCERNS.** All 13 findings are fixed and committed on `feature/phase-01-foundation` (not pushed). The final full e2e run was cut short when Claude Code stopped it for low system memory; per its instruction it was not restarted (see Tests).

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
- **Final full run:** stopped by the system at script 14 of ~50 (during the Playwright security e2e). Results so far:
  - 13/13 passed: e2e_2fa_reset, then e2e_audit_backdate through e2e_audit_roles alphabetically.
  - e2e_audit_security had passed 9/9 just before the run.
  - Not re-run, per the stop instruction. Re-run with `python -X utf8 run_all_e2e.py <repo>` from the scratchpad when memory allows.
- **Test updates:** these changed because the spec changed, not to weaken them:
  - e2e_reports E25 and F3: an out-of-scope branch now gives 403.
  - e2e_reports E9 and E18: the fee is now separate from net revenue.
  - smoke_product: added the `productCount` key.
- **Not my regression:** e2e_products assumes an empty DB (expects codes SP000001…), so it fails on the current demo data.

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

- Should a published e-invoice always block tax-code edits, regardless of the setting?
- Should `paymentDiscount` in the finance report also be branch-scoped? The customer debt ledger has no branch.
- Gateway → BFF: should the identity login limiter key by the forwarded client IP? Today it sees the gateway-appended BFF IP.
