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
- e2e: RESULTS_PLACEHOLDER

## Commits
- `refactor(sales): move service SQL into repositories` (some new files captured earlier by auto-commit hook as `auto: update ...`). Not pushed.

## Open questions
- None blocking.
