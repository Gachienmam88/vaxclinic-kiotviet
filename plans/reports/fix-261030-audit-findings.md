# Fix audit findings — progress (261030)

Status: PARTIAL. Items 1, 4, 5, 6, 7, 8 done and committed. Items 9, 10, 2, 3, 11, 12, 13 not started.
Stopped because the user sent a new request mid-run (log in to the live KiotViet store and test it); handed back to the coordinator to decide.

E2E scripts: `C:\Users\chipc\AppData\Local\Temp\claude\C--Users-chipc-Desktop-kiot-viet-clone\a238b785-acf8-44ef-bf0d-f8ed0a62f4a4\scratchpad\e2e_audit_*.py` (shared cleanup helper in `e2e_audit_kit.py`).

| # | Commit | What changed | Tests |
|---|---|---|---|
| 1 Logout | 6acc202 | `/api/auth/logout` is public in gateway + identity; the refresh token in the body authorises it. The live token row is deleted, not flagged, so a stale tab re-sending it gets 401 and doesn't trip the reuse alarm (which revokes all sessions). | `e2e_audit_logout.py` 5/5, `e2e_login_flow.py` 10/10 |
| 4 Rate limit + headers | f6da541 | Gateway `RateLimitFilter` token bucket: login/2FA 20/min/IP, refresh/logout 60/min/IP, general 900/min/user (per IP when anonymous). Returns 429 `RATE_LIMITED` + Retry-After. XFF is trusted only from loopback/private addresses. BFF forwards the browser IP. Next.js sends CSP, XFO SAMEORIGIN, nosniff and Referrer-Policy; HSTS goes in middleware only on https with secure cookies. | `e2e_audit_security.py` 9/9 (66 pages, no CSP violations, print iframe OK) |
| 5 Role defaults | e4836bb | identity `V11` seeds system roles that have no permissions (mapping in `docs/business-logic.md` §4.3). The live DB already had permissions, so it was a no-op there. | `e2e_audit_roles.py` 7/7 (rollback transaction) |
| 6 Stock-out days | 08a102f | Net sales use `SALE`, `SALE_CANCEL`, `SALE_RETURN`, `SALE_RETURN_CANCEL_OUT`. | `e2e_audit_stockout.py` 4/4 |
| 7 Ledger date | d231b48 | `Movement.occurredAt` is the document date for receipts, returns and issues, including their cancels. `stock_ledger.seq` added (`V10`). Back-dated rows trigger a `balance_after` recompute. A changed `received_at` moves the ledger rows, the PC supplier doc and the cashbook voucher (outbox UPDATE). | `e2e_audit_backdate.py` 5/5, `e2e_purchasing` 21/21, `e2e_inventory_docs` 50/50, `smoke_product_layering` 63/63 |
| 8 Cost lock | 90e5997 | Product row locked `FOR NO KEY UPDATE` (plain FOR UPDATE deadlocked against FK key-share locks) and reloaded. The moving average uses stock across all branches. | `e2e_audit_cost.py` 2/2 (6 concurrent receipts) |
| — Orders docs | 26fd7a0, 638d856 | §2.9 rewritten for the coordinator. | — |

Decisions:
- Access JWT stays stateless and valid until its TTL (≤30 min) after logout; there is no denylist.
- Ledger cancel rows are dated at the original document date so they net out on that day.
- `cost` on back-dated rows is the cost at posting time; the negative-stock check uses current stock.
- Sales-service stock docs are still posted at call time.

Found, not fixed:
- `/reports/channels`, `/reports/customers` and `/reports/employees` fail server render ("Functions cannot be passed directly to Client Components": a `text` function prop).
- `smoke_product_layering.py` expected a stale key set; I updated it for the `productCount` field that was added earlier.
- About 23 deactivated "Vắc xin test giao hàng …" products are left from older e2e runs (the kit only deactivates them).
- Order merge POST does not re-check `invoicing_id` (only the candidate list filters it).

Unresolved questions:
- Should the live-KiotViet testing go ahead? It creates real invoices and vouchers, and e-invoices may be issued irreversibly.
