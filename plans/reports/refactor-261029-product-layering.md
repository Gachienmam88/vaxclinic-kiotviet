# Refactor product-service: Controller → Service → Repository (2026-10-29)

Pure refactor. Paths, JSON shape, status codes, error codes/messages, transaction boundaries, audit timing unchanged.

## Moves

| Controller | New / reused layer | Notes |
|---|---|---|
| purchase/SupplierGroupController | **SupplierGroupService** (new) + **SupplierGroupRepository** (new, JdbcTemplate) | `@Transactional` create/update/delete + audit moved into service (audit still inside tx, as before). `GroupRequest`/`GroupResponse` → `SupplierGroupService`. `findOrCreate`/`requireExists` → service; `SupplierCommandService` now depends on `SupplierGroupService` (was the controller). |
| report/InventoryReportController | **InventoryReportService** + **InventoryReportRepository** (new) | `MovementRow`, `MonthValue`, `DamageRow` → `InventoryReportRepository`. |
| report/SupplierPaymentDiscountReportController | **SupplierPaymentDiscountReportService** + **...Repository** (new) | Uses `InventoryReportRepository.MonthValue` (was `InventoryReportController.MonthValue`). |
| report/SupplierReportController | **SupplierReportService** + **SupplierReportRepository** (new) | `SupplierRow`, `SupplierDebtRow` → repository. |
| report/ProductReportScope | signature `params(from, to, branchIds, List<String> branchClaim)` (was `Jwt`) | Called from services; controllers pass `jwt.getClaimAsStringList("branches")`. Kept claim list (not `Actor`) so internal tokens w/o UUID subject still work. |
| stock/StockBookController | **StockBookService** (VN date → instant) + **StockBookRepository** (new) | `StockBookLine`, `ProductCategory` → repository. |
| catalog/CatalogLookupController | **CatalogLookupService** (new, JPA repos reused) | 4 `@Transactional` methods (createCategory, updateCategory, deleteCategory, createPosition) moved; request/response records → service. |
| inventory/StockIssueController | **StockIssueManageService** (new, non-tx) → StockIssueService | type parsing (`ISSUE_TYPE_INVALID`) + audit after commit. |
| inventory/StockTakeController | **StockTakeManageService** (new, non-tx) → StockTakeService | audit after commit. |
| pricebook/PriceBookController | **PriceBookManageService** (new, non-tx) → PriceBookService / PriceBookItemService / PriceBookRowQuery | audit after commit. |
| product/ProductController | **ProductManageService** (new, non-tx) → ProductCommandService + queries | `SaleCatalogResponse` → `ProductManageService`. |
| purchase/PurchaseController | **PurchaseManageService** (new, non-tx) → PurchaseReceiptService / PurchaseReturnService | audit after commit. |
| purchase/SupplierController | **SupplierManageService** (new, non-tx) → SupplierCommandService / SupplierImportService / SupplierListQuery | `NoteRequest`/`StatusRequest` stay in controller (HTTP-only DTOs). |
| purchase/SupplierDebtController | **SupplierDebtManageService** (new, non-tx) → SupplierDebtService / SupplierDebtQuery | `KIND_LABEL` + audit moved. |

Shared: `PurchaseDtos.Actor.of(Jwt)` added; replaces the 3 duplicate helpers (`InventoryDocDtos.actor`, `SupplierController.actor`, private `PurchaseController.actor`, all removed).

Untouched (already thin): `InternalStockController`, `StockAlertJobController`.

## Behaviour differences

- None observable. Only theoretical: write endpoints that previously parsed `jwt.getSubject()` as UUID only at audit time (after save) now parse it in the controller via `Actor.of(jwt)` before the call. A non-UUID subject would now fail before the write instead of after it. All user JWTs have UUID subjects; report endpoints deliberately avoid `Actor` so non-UUID internal tokens behave as before.
- Page/size clamping and filter record building stay in controllers (HTTP → DTO mapping); filter records have no validating constructors, so moving validation (e.g. issue type) after their construction changes nothing.

## Verification

- `mvn -q -o -pl product-service -am compile` OK; `mvn -q -pl product-service -am package` OK (unit tests pass).
- Redeployed :8082 only; `/actuator/health` = 200.
- `grep -rl JdbcTemplate --include=*Controller.java backend/product-service/src/main` → empty.

| Script | Result |
|---|---|
| e2e_purchasing | 21/21 |
| e2e_suppliers | 59/59 |
| e2e_inventory_docs | 50/50 |
| e2e_reports (+ e2e_reports_checks + e2e_reports_supplier_discount via exec, F1–F5 pass) | 39/39 (40 PASS lines) |
| e2e_reports_supplier_discount (standalone) | NameError `R`: it is an exec'd module of e2e_reports, not standalone |
| e2e_price_books | 40/40 |
| e2e_sales | 22/22 |
| e2e_sale_backend | 57/57 |
| e2e_edit_return | 18/18 |
| e2e_settings | 31/31 |
| e2e_products | 11/16; checks 1, 6, 9, 9b, 14 fail because they hard-code a fresh DB (`SP000001`/`SP000002` codes, `total == 2`, 3 products in first category). Observed values are correct for the current DB: new product got SP000019/SP000020, inactive filter returned exactly SP000019; unit-code search re-verified dynamically (SP000024 → SP000023). Not caused by the refactor. |
| smoke_product_layering.py (new, read/validation only, no writes) | 63/63: catalog lookups + errors, supplier group errors, all 6 kho/NCC report endpoints (keys, bad range 400, foreign branch []), S2d stock book, issue-type errors, list clamps, 404s, sale-catalog both shapes |

## Service-level SQL left (not reworked this pass)

JdbcTemplate in non-`@Repository` classes: internal/CashflowOutbox, internal/InternalStockService, inventory/InventoryDocListQuery, notification/StockAlertJob, pricebook/PriceBookItemService, pricebook/PriceBookRowQuery, pricebook/PriceBookService, pricebook/SalePriceBookQuery, product/ProductListQuery, product/SaleCatalogQuery, purchase/PurchaseListQuery, purchase/SupplierCommandService, purchase/SupplierDebtAllocator, purchase/SupplierDebtQuery, purchase/SupplierDebtService, purchase/SupplierListQuery.

## Unresolved questions

- e2e_products assumes an empty DB and has no cleanup; each run leaves 3 products + 1 category (this run: SP000019–SP000021). Rewrite it to use relative codes and clean up?
- Should the `*Query` components (read-only JdbcTemplate) be renamed / annotated `@Repository` in a later pass, or stay as-is?
