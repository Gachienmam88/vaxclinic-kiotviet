# Detail collapse on re-click + KiotViet empty states

## 1. Collapse detail
- Row re-click: already toggled on every list (verified each page's `setExpanded(cur === id ? null : id)` / `toggle`). Unchanged.
- Active-tab re-click: new shared `src/components/ui/detail-tabs-list.tsx`
  - `DetailTabsList` = TabsList + `onActiveTabClick`; onClickCapture reads `aria-selected` before base-ui activates (base-ui activates on click, `activateOnFocus` off) → re-click / Enter / Space on active tab collapses; clicking another tab just switches.
  - `DetailSingleTab` = focusable `<button>` replacing static "Thông tin" span (purchases receipts/returns, inventory frame).
- Each panel got `onClose?: () => void`; list pages pass `() => setExpanded(null)` / `s.toggle(id)` / `onToggle(id)`.
- Panels: products, invoices, sales returns, customers, cashbook, orders, shipments (Vận đơn + Quản lý giao hàng + partner tab), delivery partners, purchase receipts, purchase returns, stock takes, damages + internal use (stock-issue).
- Not applicable (no tab bar): employees, payslips, input invoices (row toggle already works). Settings lists have no row detail.

## 2. Empty states
- `ListEmptyState`: compact + no period → no "với điều kiện lọc" suffix (sentence ends "phù hợp."). Added `ListEmptyRow({cols, ...})` (tr/td wrapper).
- Lists (summary row hidden when empty): orders, invoices, sales returns, customers, delivery partners, shipments, payrolls, products, input invoices, payslip table. Lists w/o summary: cashbook (fund summary card kept), employees, customer groups, price books.
- onWiden (Tháng này → all): orders/returns/shipments → mode "all"; invoices/cashbook (sidebar has no "Toàn thời gian") → mode "custom" with empty dates (same as purchases).
- Compact detail-tab tables: invoice/order payment history, customer debt + sales tabs, partner ledger + settlements + shipments, product ledger + lots, receipt lines, payroll payment history.
- Settings (compact): users, branches (new empty row), roles, audit logs, bank accounts/e-wallets.
- Skipped: dialogs, pickers, reports, HR grids, workdays settings (already KiotViet text), accounting.

## Validation
- `npx tsc --noEmit -p .` clean; `npx eslint` on 47 changed files clean. All files < 200 lines.
- Not visually verified (3010 runs the pre-change build).

## Unresolved
- After collapse via tab, focus lands on body (tab unmounts); could move focus back to row — not done.
