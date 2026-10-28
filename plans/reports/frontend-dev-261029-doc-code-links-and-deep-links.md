# Doc code links (DocCodeLink) + ?code= deep links app-wide

## Shared infra
- `components/ui/doc-code-link.tsx` (API unchanged). Prefix table checked against backend `"XX%06d"` formats:
  - Added DS (delivery settlement) → /delivery/partners.
  - Compound codes: after the prefix, either digits or another doc code plus digits (`/^(?:[A-Z]{2,3})?\d/`). This makes the auto-generated cashbook vouchers link: PC+PN/TH/DH/DS…, PT+DS…, TT+HD/DH (incl. `-2` suffix).
  - Removed CKTT and DC: customer debt discount/adjust docs live only in the debt ledger and never create a cashbook voucher → shown as plain text unless the caller passes `to`.
  - XH / XNB come from `StockIssue.Type.prefix` and were already correct.
- New `components/ui/deep-link-route.tsx`:
  - `DeepLinkRoute` is a Suspense wrapper; it reads ?code= / ?id= and remounts the page when the query changes.
  - `useDeepLinkExpanded(items, link, codesOf)` returns `{open, setOpen, toggle}`.
  - `sameCode` compares codes case-insensitively.
- Report paper CSS: `.rp-table a` changed to #2171bc, with hover #1a9dcc + underline.

## Pages with ?code= (+ ?id=)
| Page | What happens |
|---|---|
| /products | product code or unit code, all statuses |
| /purchases/receipts, /purchases/returns | all statuses, all time |
| /purchases/suppliers | NCC → search. PCN/CKN/DCN/PC+PN → new backend `docCode` filter, then opens the "Nợ cần trả NCC" tab and the doc dialog |
| /inventory/stock-takes, /damages, /internal-use | all statuses, all time |
| /customers | search by code |
| /returns | period widened to all time |
| /orders | all time, all statuses |
| /cashbook | fund ALL, period unlimited, PAID+CANCELLED, opens voucher detail |
| /delivery, /delivery/shipments | all time, all statuses |
| /delivery/partners | DT by code. DS → finds the owning partner among page 1 partners' settlements, opens the payment tab |
| /employees | NV, any status (until the filter changes) |
| /employees/payrolls | BL → router.replace to /employees/payrolls/[id] |
| /invoices | owned by the invoice agent |

## Converted to DocCodeLink
- **Purchases**
  - Receipt/return detail: supplier code and line product codes.
  - Lists: "Mã NCC" and "Theo phiếu nhập" columns.
  - Supplier history/debt tabs, allocation table and debt-doc dialog: link colours.
  - Editors: links open in a new tab.
- **Products and inventory:** stock card doc codes, price book product codes, stock-take / stock-issue line product codes.
- **Input invoices:** "Đã lập phiếu PN…" badge.
- **Sales**
  - Returns: invoice codes in the list column and the detail, plus product codes in the detail.
  - Orders: customer code, invoice badge, payment history.
  - Cash voucher detail: "Chứng từ gốc" link and linked invoices.
  - Customer tabs: debt and sales tabs.
  - Debt allocation table: links open in a new tab.
- **Delivery:** invoice codes in the shipment list. Shipment detail: invoice, settlement and return codes. Invoice shipment info. Partner ledger, settlements and vouchers. Reconcile dialog.
- **Dashboard:** recent activity.
- **HR:** payroll payment history (PCPL), payslip employee codes, commission product codes, commission grids, schedule/timesheet employee codes, pay dialog.
- **Reports:** all `rp-link` code cells (end of day, sales, orders + invoice column, party/debt, products, suppliers + product column, supplier dimension). CSV untouched.
- **Accounting books:** S2d product codes and S2e voucher codes; these show in the normal text colour when printed.
- **Settings audit log:** docCode inside the detail text.
- **Stays plain:** a list's own code column, headers of the record that is open, print output.

## Backend
- product-service `SupplierController.search` takes an optional `docCode`. `SupplierListQuery.Filter` has a new field and an `exists` check on `supplier_debt_docs.code` (case-insensitive exact match).
- `mvn -o -pl product-service -am compile` passes.

## Validation
- `npx tsc --noEmit -p .`: clean except `features/pos/pos-screen.tsx`, owned by the POS agent.
- eslint: clean on all changed files.
- Not tested in a browser.

## Unresolved
- **DS deep link:** only works when the owning partner is on page 1. There is no settlement-by-code API (sales-service was not touched).
- **CKTT / DC:** have no page of their own, so they stay plain text.
- **Cash voucher partner codes:** can't be linked, because the voucher stores only the partner name and id.
- **?id= alone:** a row only opens if it shows on the first page of the default list; most lists can't filter by id.
- **Enter key on a link inside a clickable row:** also toggles the row (keydown bubbles).
- **Blue link on the green input-invoice badge:** needs a visual check.
