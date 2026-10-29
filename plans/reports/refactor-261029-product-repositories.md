# Refactor 261029 — product-service: service SQL → @Repository

Pure refactor. HTTP API, JSON, status/error codes, SQL text (verbatim), @Transactional (incl. MANDATORY), `for update` locks, FEFO lot allocation, stock idempotency (external_stock_docs), cashflow outbox, @Scheduled/synchronized, audit, notifications unchanged. Controllers untouched except reference renames.

## Renames (git mv, @Component → @Repository)
| Old | New |
|---|---|
| `inventory/InventoryDocListQuery` | `InventoryDocListRepository` |
| `pricebook/PriceBookRowQuery` | `PriceBookRowRepository` (static `from`/`COST`/`LAST_PURCHASE` kept) |
| `pricebook/SalePriceBookQuery` | `SalePriceBookRepository` |
| `product/ProductListQuery` | `ProductListRepository` (`StockFilter`, `Filter` moved with it) |
| `product/SaleCatalogQuery` | `SaleCatalogRepository` |
| `purchase/PurchaseListQuery` | `PurchaseListRepository` |
| `purchase/SupplierListQuery` | `SupplierListRepository` (`LEDGER`, records kept) |
| `purchase/SupplierDebtQuery` | `SupplierDebtQueryRepository` (write side became `SupplierDebtRepository`) |

Refs updated in controllers, *ManageService, SupplierDebtService/Allocator, SupplierRepository javadoc. No test referenced them.

## Extractions (class keeps logic / tx / locks order; SQL moved)
- `PriceBookService` → new `PriceBookRepository` (list, find, insert, update, recalculateItems, delete; `params`, `pgArray`, `uuids`, row mapper moved). DuplicateKeyException → 409 translation stays in service. `SalePriceBookRepository` now uses `PriceBookRepository.uuids`.
- `PriceBookItemService` → new `PriceBookItemRepository` (countUnits, delete, upsert, applyFormula, unitIdsByCode). FORMULA_BOOK_REQUIRED check + `books.get(baseBookId)` stay in service, run just before the repo call.
- `CashflowOutbox` (@Transactional MANDATORY, @Scheduled publish, stop-at-first-error kept; JSON built in outbox) → new `internal/CashflowOutboxRepository` (insert, pending, markSent, markFailed).
- `InternalStockService` (213 → 194 lines) → new `internal/ExternalStockDocRepository` (find / insert of the idempotency row; JSON (de)serialization of `StockDocResult` moved with it, same IllegalStateException on JSON error). Lock order (balance `findForUpdate` before reading lots), FEFO, SALE_REPLACE flow untouched.
- `StockAlertJob` (@Scheduled, synchronized kept; message text built in job) → new `notification/StockAlertRepository` (expiringLots, lowStock; same raw maps).
- `SupplierDebtService` (201 → 181), `SupplierDebtAllocator`, `SupplierCommandService.delete` → new `purchase/SupplierDebtRepository` (seq, insertDoc, insertReceiptPayment, lockDoc `for update`, updateDoc, cancelDoc, revertPaidAmounts, cancelActiveDocsOfReceipt, activePaymentAllocated, deleteActiveAllocations, lockReceipt `for update`, settled, insertAllocation, addPaidAmount, transactionCount). Call order inside each method identical (e.g. receiptCancelled: cancel docs → sum → delete → entity paid_amount).

## Behaviour differences (minor, intentional)
- Repos are @Repository → exception-translation proxy; JdbcTemplate already throws DataAccessException (DuplicateKeyException path for price book names unchanged).
- `applyFormula`: BOOK base validation now runs before parameter building instead of inside the switch — same result/error; `op`/`base` are @NotNull.
- No new bean cycles (repos depend only on JdbcTemplate/ObjectMapper); no @Lazy.

## Verification
- `grep -rl JdbcTemplate --include=*.java backend/product-service/src/main | xargs grep -L @Repository` → empty.
- `mvn -pl product-service -am package` OK (unit tests pass). 8082 redeployed via start-all-local.ps1, health 200.
- e2e (8082 redeployed): e2e_purchasing 21/21, e2e_suppliers 59/59, e2e_inventory_docs 50/0, e2e_reports 39/39, e2e_price_books 40/0, e2e_sales 22/22, e2e_sale_backend 57/57, e2e_edit_return 18/18, e2e_offline_sync PASS (1 invoice, stock once), e2e_hardening PASS (checkout_attempts left 0), e2e_settings 31/31, e2e_notifications ALL PASSED, e2e_delivery 37/37, e2e_orders_groups 34/34, smoke_product_layering 63/63. Cleanups 0 leftover rows. e2e_products skipped (fresh DB).

## Commits
- `refactor(product): move service SQL into repositories` (new files captured earlier by auto-commit hook as `auto: update ...`). Not pushed.

## Notes / open questions
- `purchase/PurchaseReceiptService.java` is 218 lines (no SQL, out of scope) — candidate for a later split.
- e2e_products skipped (needs fresh DB), per instructions.
