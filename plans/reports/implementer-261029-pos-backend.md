# Implementer report — POS backend (sales-service) — 2026-10-29

## Migration
`backend/sales-service/src/main/resources/db/migration/V13__pos_einvoice_buyer_quick_return.sql` (applied by Flyway, schema v13)
- invoices + einvoice_buyer_name/company_name/tax_code/address/email/phone (nullable)
- sales_returns.invoice_id DROP NOT NULL
- sales_return_lines + cost NUMERIC(18,4) NULL

## Endpoints / contracts
1. E-invoice buyer: `InvoiceRequest.einvoiceBuyer` (last component), `InvoiceResponse.einvoiceBuyer` (last; null when none / all blank). POST + PUT save it; PUT without the field clears it (missing = none).
2. Quick return: POST /api/sales-returns with invoiceId null → `QuickReturnService`. ReturnRequest + `branchId`, `customerId`; LineInput + `productId`, `unitId`, `lotNumber`, `expiryDate`, `invoiceLineId` optional. Unit/rate/lotManaged from GET {product-url}/api/products/{id} with the caller's JWT (never client rate). baseQty = qty × conversionRate. Line cost = stock unitCost × rate. Walk-in must refund full total. PC{code} note "Trả nhanh {code}", debt RETURN/REFUND + totalReturns as before. Cancel works unchanged. Invoice path unchanged (now also stores rl.cost = il.cost).
3. GET /api/invoices/last-prices?customerId&productIds=a,b → [{productId, unitId, price, soldAt, invoiceCode}] (productIds optional).
4. GET /api/invoices/returnable (code, shipmentCode, lot, customer, productCode, productName, from, to, branchId, sort, page, size=7 max 50) → {items:[{id, code, soldAt, employeeName, customerName, total}], total}; COMPLETED only.
5. GET /api/orders/pos-search (code, customer, note, productCode, productName, from, to, branchId, page, size=10 max 50) → {items:[{id, code, orderedAt, customerName, total, status, note}], total}; status DRAFT/CONFIRMED (= CustomerOrder.isOpen).
6. Mixed payment: `InvoiceRequest.extraPayments` [{method, amount, bankAccountId}]. Vouchers TT{code}-2, -3… source_type `INVOICE_EXTRA`, source_id = invoice, allocated, fund by method, debt PAYMENT each. Σextras > due → 400 EXTRA_PAYMENT_EXCEEDS; primary capped to due − Σextras (cash change). Edit: extras untouched, TT = paidAmount − Σactive extras, < extras → 400 INVOICE_EXTRA_PAYMENTS; customer change blocked when extras exist. Cancel cancels all extras (+ PAYMENT_CANCEL each). Manual cashbook cancel of INVOICE_EXTRA blocked (VOUCHER_AUTO). Invariant paid = Σ allocations (+ COD) kept: extras are normal allocations.
7. Idempotency: POST /api/sales-returns YES (exists check in service + writer, stock idempotent by docId; e2e #23, e2e_edit_return #8). POST /api/orders YES (OrderService.create findById → returns existing; e2e #45). Concurrent identical requests: second may get a PK-conflict error, never a double write.

## Reports
LEFT JOIN invoices for returns + COGS `coalesce(il.cost, rl.cost, 0)`: FinanceReport, SalesSummary, EndOfDay, ProductSales, RevenueBook (cogs only). Quick returns: seller = return creator, channel = DIRECT. ReportFilter seller / saleMode / priceBook / channel filters exclude quick returns (documented in ReportFilter.returnWhere). SellerRevenueInternalController untouched (needs i.seller_id; quick returns have no seller → excluded from commission).

## Files
New: invoice/InvoiceExtraPayments.java, invoice/InvoicePosLookupController.java, order/OrderPosSearchController.java, salesreturn/QuickReturnService.java, salesreturn/ProductCatalogClient.java, V13 migration.
Modified: invoice/{InvoiceDtos, Invoice, InvoiceWriter, InvoiceEditWriter, InvoiceService, InvoiceQuery (detail only)}, salesreturn/{SalesReturnDtos (+back-compat ctors), SalesReturnService, SalesReturnWriter, SalesReturnController}, cashbook/{CashVoucherRepository, CashbookService}, report/{Finance, SalesSummary, EndOfDay, ProductSales, ReportFilter (comment)}, accounting/RevenueBookController.

## Tests (scratchpad)
- e2e_pos_backend.py (new): 47/47
- e2e_delivery.py 37/37, e2e_reports.py 39/39, e2e_orders_groups.py 34/34, e2e_edit_return.py 18/18, e2e_sales.py 22/22, e2e_offline_sync.py PASS
- Patched test setup only (DB wiped, no categories): e2e_orders_groups.py (temp category + cleanup), e2e_edit_return.py / e2e_sales.py (create category "Nhóm test sửa trả" if none; these scripts never cleaned up).

## Limitations
- Quick return lot must already exist at the branch: product-service SALE_RETURN passes no expiry → new lot fails (EXPIRY_REQUIRED) → mapped to 400 LOT_NOT_FOUND. `expiryDate` accepted but unused.
- InvoiceService.java now 235 lines (> 200 guideline).
- Cashbook rows of source_type INVOICE_EXTRA: frontend links that check `sourceType === 'INVOICE'` will not treat them as invoice vouchers.

**Status:** DONE_WITH_CONCERNS
**Summary:** All 6 features + idempotency check done in sales-service; migration V13 applied; all e2e pass.
**Concerns:** lot limitation above; PUT without einvoiceBuyer clears it (per contract).

## Unresolved questions
- Should the quick return expiry be supported later (needs product-service Line.expiryDate)?
- Should quick returns count in seller commission (SellerRevenueInternal) under the return creator?
