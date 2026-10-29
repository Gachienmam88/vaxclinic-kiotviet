# Refactor 261029 — sales-service: service SQL → @Repository

Pure refactor. HTTP API, JSON, status/error codes, SQL text (verbatim), @Transactional (incl. MANDATORY), `for update` locks, @Scheduled/synchronized, audit, notifications unchanged. Controllers untouched except reference renames.

## Renames (git mv, @Component → @Repository)
| Old | New |
|---|---|
| `cashbook/CashbookQuery` | `CashbookRepository` (+ `insertAllocation`, `allocationRows` from CashbookWriter) |
| `customer/CustomerListQuery` | `CustomerListRepository` |
| `delivery/DeliveryPartnerQuery` | `DeliveryPartnerRepository` (+ CRUD from DeliveryPartnerService, `contact`, `activeOf`) |
| `delivery/ShipmentQuery` | `ShipmentQueryRepository` |

Records (`Filter`, `Page`, ...) moved with the class; refs updated (controllers, *ManageService).

## Extractions (class keeps logic / tx / locks order; SQL moved)
- `CashbookWriter` → `CashbookRepository.insertAllocation/allocationRows`.
- `SalesChannels` → existing `SalesChannelRepository.list/activeRows` (`Channel` record stays in SalesChannels).
- `CustomerGroupService` → new `CustomerGroupMemberRepository`.
- `DebtLedger` (lock via JPA `findForUpdate`, then insert — same order) + `DebtService` (seq) → new `debt/DebtLedgerRepository`.
- `DeliveryPartnerService` → `DeliveryPartnerRepository` (DuplicateKeyException still caught in service).
- `PartnerLedger` → new `PartnerLedgerRepository` (lockDebt `for update` → updateDebt → insert, same order).
- `DeliverySettlementService` → new `DeliverySettlementRepository` (lock shipments / settlement `for update`, insert, cancel) + `DeliveryPartnerRepository.contact`.
- `ShipmentInvoiceHooks` → new `ShipmentRepository` (by id: insert, find, lock, update, status, cancel, log) + new `ShipmentInvoiceRepository` (by invoice: activeStatus, lockActive, updateCod/Delivery, info, invoiceCustomerId) + `DeliveryPartnerRepository.activeOf`.
- `ShipmentEditService`, `ShipmentStatusService`, `ShipmentStatusWriter` → `ShipmentRepository`.
- `ShipmentCreateService` → `SalesReturnRepository.countCompletedByInvoice`; `ShipmentReturnService` → `ShipmentInvoiceRepository.invoiceCustomerId` + `SalesReturnRepository.returnedQuantity`.
- `InvoiceLineBuilder` → new `InvoiceLineLotRepository.add`; `SalesReturnService` lot picks → `InvoiceLineLotRepository.returnableLots/soldBaseQuantity`.
- `InvoiceExtraPayments` + `InvoiceEditWriter` → new `InvoicePaymentRepository` (activeTotal, deleteAutoAllocations).
- `InvoiceQuery` (keeps Filter, detail assembly, @Transactional(readOnly), e-invoice lookup call) → new `InvoiceQueryRepository`.
- `InvoiceService` (252 → 188 lines): pre-checks of update / cancel moved verbatim, same order, into new `InvoiceChangeGuard` (`checkEditable`, `autoReceiptAmount`, `checkCancellable`); `hasReturns` → `SalesReturnRepository.countCompletedByInvoice` (identical SQL). Create flow (checkout_attempts begin → stock → persist, order claim release) untouched.
- `OrderDepositLedger` → new `OrderDepositRepository` (claim / release `order invoicing` idempotency SQL, remainders, detach) + `CashbookRepository.insertAllocation` (identical SQL).
- `OrderQuery` (keeps Filter, detail) → new `OrderQueryRepository`.
- `SalesReturnWriter`, `QuickReturnService`, `SalesReturnService` → new `SalesReturnRepository` (exists/find/insert/lines/lots/lock/cancel/seq/returnedQuantity).
- `SalesAlertJob` (@Configuration, @Scheduled, synchronized kept) → new `SalesAlertRepository` (raw `DueOrder` / `ReturningShipment` records; message text built in job).

## Behaviour differences (minor, intentional)
- Row callbacks that only filled a map/list now return the collection from the repo (CustomerGroup counts, invoice returned-by-line, lot picks) — same query, same result.
- `SalesAlertJob`: rows mapped to records first, Items built after the query (no bean calls inside callbacks before either). Lists now immutable `toList()`; job copies into ArrayList as before.
- Repos are @Repository → exception-translation proxy; JdbcTemplate already throws DataAccessException (DuplicateKeyException path unchanged).
- No new cycles: guard/repos depend only downward; no @Lazy added.

## Verification
- `grep -rl JdbcTemplate --include=*.java backend/sales-service/src/main | xargs grep -L @Repository` → empty.
- `mvn -pl sales-service -am package` OK (unit tests pass). 8086 redeployed via start-all-local.ps1, health 200.
- e2e (8086 redeployed): e2e_sales 22/22, e2e_sale_backend 57/57, e2e_edit_return 18/18, e2e_offline_sync PASS (1 invoice, stock once), e2e_orders_groups 34/34, e2e_invoice_filters 15/15, e2e_reports 39/39, e2e_sectors_wallets 12/12, e2e_delivery 37/37, e2e_price_books 40/0, e2e_hr 85/0, e2e_settings 31/31, e2e_notifications ALL PASSED, e2e_hardening 25/25 (checkout_attempts left 0), e2e_suppliers 59/59, smoke_sales_layering 49/49. All cleanups 0 leftover rows.

## Commits
- `refactor(sales): move service SQL into repositories` (some new files captured earlier by auto-commit hook as `auto: update ...`). Not pushed.

## Open questions
- None blocking.
