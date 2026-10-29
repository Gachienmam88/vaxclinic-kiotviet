# Refactor sales-service: Controller → Service → Repository (2026-10-29)

Pure refactor. Paths, JSON shape, status codes, error codes/messages, transaction boundaries unchanged.
`grep -rl JdbcTemplate --include=*Controller.java backend/sales-service/src/main` → empty. Every controller now depends only on 1–2 @Service beans (no Query/Repository/AuditLogger/@Transactional/BusinessException in controllers).

## What moved where (package `com.vaxclinic.sales`)

| Controller | Service (logic, @Transactional, audit) | Repository (SQL) | DTO location |
|---|---|---|---|
| accounting/RevenueBookController | RevenueBookService | RevenueBookRepository | DailyRevenue/DailyExpense nested in repo |
| accounting/SellerRevenueInternalController | SellerRevenueService | SellerRevenueRepository | SellerRevenue nested in repo |
| channel/SalesChannelController | SalesChannelService (create/update/delete @Transactional, audit inside tx as before) | SalesChannelRepository (+ existing SalesChannels for list) | ChannelRequest → SalesChannelService |
| cashbook/CashbookController | CashbookManageService (list, get @Transactional(readOnly), create/cancel + audit, inbound) + BankAccountService (update @Transactional) | CashbookQuery (+ `allocations()`), JPA repos | Allocated → CashbookQuery; BankAccountRequest → BankAccountService |
| customer/CustomerController | CustomerManageService (wraps CustomerService / DebtService + audit) | CustomerDebtRepository (new), CustomerListQuery, CustomerRepository | DebtLine → CustomerDebtRepository |
| customer/CustomerGroupController | CustomerGroupManageService (audit) | — (CustomerGroupService unchanged) | unchanged |
| invoice/InvoiceSaleLookupController | InvoiceSaleLookupService (page/size clamp) | InvoiceSaleLookupRepository | LastPrice/ReturnableItem/ReturnableFilter nested in repo |
| invoice/InvoiceController | InvoiceManageService (detail re-read + audit) | InvoiceQuery (unchanged) | unchanged |
| invoice/InternalInvoiceController | InternalInvoiceService (@Transactional(readOnly), buyer mapping) | JPA repos | Buyer/Line/EInvoiceSource → InternalInvoiceService |
| order/OrderSaleSearchController | OrderSaleSearchService | OrderSaleSearchRepository | SaleOrderItem/Filter nested in repo |
| order/OrderController | OrderManageService (refundMethod validation, audit, toInvoice) | OrderQuery (unchanged) | unchanged |
| report/CustomerDebtReportController | CustomerDebtReportService (range check) | CustomerDebtReportRepository | DebtRow nested in repo |
| report/EndOfDayReportController | EndOfDayReportService (`f.params(actor)`) | EndOfDayReportRepository | DocRow/VoucherRow nested in repo |
| report/FinanceReportController | FinanceReportService | FinanceReportRepository | MonthRow nested in repo |
| report/OrderReportController | OrderReportService | OrderReportRepository | rows nested in repo |
| report/ProductSalesReportController | ProductSalesReportService (group check before range check, as before) | ProductSalesReportRepository (DIMS + `supportsGroup`) | ProductRow nested in repo |
| report/SalesSummaryReportController | SalesSummaryReportService (same) | SalesSummaryReportRepository | SummaryRow nested in repo |
| salesreturn/SalesReturnController | SalesReturnManageService (exists check, re-read, audit) | SalesReturnQueryRepository (list/lines/detail) | Filter/Page nested in repo |
| delivery/DeliveryPartnerController | DeliveryPartnerManageService (branch intersection, audit) | DeliveryPartnerQuery (unchanged) | unchanged |
| delivery/DeliverySettlementController | DeliverySettlementManageService (audit) | — | unchanged |
| delivery/ShipmentController | ShipmentManageService (branch intersection, page clamp, audit) | ShipmentQuery (unchanged) | ListRequest (new) in ShipmentManageService |

SalesAlertJobController unchanged (already only delegates). No nested record was referenced outside its controller (checked main + test).

Design choice: where the controller called an existing @Transactional method and audited afterwards, the audit lives in a new non-transactional `*ManageService` that calls the transactional bean, so audit still runs after commit (exact behaviour; no self-invocation proxy pitfall). Existing core services (CustomerService, CashbookService, OrderService, DebtService, InvoiceService, DeliveryPartnerService, DeliverySettlementService, SalesReturnService...) untouched.

## Behaviour differences
- None intended. `Actor.of(jwt)` now parsed in the controller before the call instead of at audit time (JWT subject is always a UUID; no observable effect).
- Every string literal (SQL, error codes, messages, audit texts) of the 21 old controllers verified present verbatim in new sources (scratchpad `check_literals.py`, missing=0).
- Kept quirk: sales-returns list offset still `page × raw size` (limit clamped to 100) — as before.

## Verification
- `mvn -q -pl sales-service -am package` OK (unit tests pass). Redeployed :8086 only, health 200.
- E2E all PASS: e2e_sales 22/22, e2e_sale_backend 57/57 (includes e2e_sale_backend_new_lot checks 48–57 + /internal/seller-revenue), e2e_edit_return 18/18, e2e_offline_sync PASS, e2e_orders_groups 34/34, e2e_invoice_filters 15/15, e2e_reports 39/39 (includes e2e_reports_checks E1–E28), e2e_sectors_wallets 12/12, e2e_delivery 37/37, e2e_price_books 40/40, e2e_hr 85/0, e2e_settings 31/31.
  - e2e_sale_backend_new_lot.py and e2e_reports_checks.py are modules exec'd by their parent scripts; standalone they print nothing / NameError (same before the change).
- Extra read/validation-only smoke (scratchpad `smoke_sales_layering.py`, no data written) 49/49: cashbook categories/list clamp/get 404/cancel 404, bank account vietqr/update 404 + deactivate no-op, channel DIRECT builtin 400 / unknown 404 / blank name 400, customer 404 / debts / groups, group delete 404, returnable & sale-search clamp 50, last-prices, order cancel bad refundMethod 400, sales-returns list keys + 404, all 8 report endpoints range 400 + OK, group-invalid precedence, revenue expenses, delivery partner ledger 404 / reconcilable, shipments list / 404.
- /internal/cashflows not smoke-tested (write-only endpoint; pure delegation to unchanged CashbookService.inbound).

## Services / components still running SQL directly (not @Repository; not changed this pass)
CashbookQuery, CashbookWriter, SalesChannels, CustomerGroupService, CustomerListQuery, DebtLedger, DebtService, DeliveryPartnerQuery, DeliveryPartnerService, DeliverySettlementService, PartnerLedger, ShipmentCreateService, ShipmentEditService, ShipmentInvoiceHooks, ShipmentQuery, ShipmentReturnService, ShipmentStatusService, ShipmentStatusWriter, InvoiceEditWriter, InvoiceExtraPayments, InvoiceLineBuilder, InvoiceQuery, InvoiceService, SalesAlertJob, OrderDepositLedger, OrderQuery, QuickReturnService, SalesReturnService, SalesReturnWriter.

## Unresolved questions
- Follow-up: split the SQL of the services above (esp. *Service classes: DebtService, DeliveryPartnerService, DeliverySettlementService, Shipment*Service, SalesReturnService, InvoiceService) into repositories? `*Query` / `*Writer` components are already data-access classes — rename/annotate as @Repository?
- `*ManageService` naming (precedent HrSettingsManageService) adds a second service per package; OK, or prefer merging audit into core services with after-commit hooks?
