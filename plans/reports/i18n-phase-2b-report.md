# i18n phase 2b — sales / customers / cashbook / orders / delivery / dashboard

Status: **DONE_WITH_CONCERNS**. Followed `plans/reports/i18n-guide.md`. Nothing committed.

## Summary
- **New namespaces (vi/en/ja/zh):**

  | Namespace | Keys (approx.) |
  |---|---|
  | `sales` | ~181 |
  | `customers` | ~175 |
  | `cashbook` | ~95 |
  | `orders` | 69 |
  | `delivery` | 179 |
  | `dashboard` | ~55 |

- **Server layouts with `I18nPreload`:**
  - invoices: `[sales, delivery]`
  - returns: `[sales]`
  - customers: `[customers, sales]`
  - cashbook: `[cashbook, sales]`
  - orders: `[orders, sales]`
  - delivery: `[delivery, sales]`, which also covers shipments and partners.
- **Dashboard preload:** `app/(admin)/page.tsx` is now a server wrapper around `I18nPreload ["dashboard"]`. The client content moved to `features/dashboard/dashboard-page-content.tsx`. A layout at `(admin)/` is shared, so I did not use one.
- **New helper:** `features/sales/i18n-enum-label.ts`. `enumLabel(t, ns, group, value)` labels server enum strings and returns the raw value when the key is unknown.
- **Shared kit translated inside:** `invoice-list-kit`, `ListPager` and `CsvExportButton` are also used by hr, purchases, reports and integrations. Their prop signatures are unchanged.
  - `PeriodFilter` and `ListPager` now render translated defaults.
  - `ListPager` still prints its `unit` prop as given, so callers must pass translated text.
- **Vietnamese constants kept:** `PAYMENT_METHODS`, `methodLabel`, `FUND_LABEL`, `DEBT_TYPE_LABEL`, `stateLabel`, `ORDER_STATUS_OPTIONS`/`orderStatusLabel`, `FEE_PAYERS` and `SHIPMENT_STATUSES` still return Vietnamese, because print and CSV export use them. The UI translates the enum values at render time instead.
- **Removed:** `einvoiceLabel` and `einvoiceStatusesLabel` became orphans after these changes, so I deleted them.
  - Two other exports were replaced by value-only lists: `PARTNER_TYPE_OPTIONS` became `PARTNER_TYPES`, and `FUNDS` became `FUND_OPTIONS`. Nothing outside their files used them.
  - `PERIOD_LABELS` was replaced by `PERIOD_KEYS`.
- **Signature changes:**
  - `timeAgo(iso, t)`, `confirmStatus(t, …)` and `exportShipments(t, …)`: all callers are updated.
  - `shortMoney(v, t?)` now takes an optional `t`. Without it the units stay Vietnamese, so the reports area still compiles unchanged.

## What stays Vietnamese
- **Fixed formats and data:** VND, dd/MM/yyyy and `formatMoney`. Business data stays as is: customer, partner and branch names, notes, cash categories, addresses, and audit-log action/feature text from the server. API errors go through `errorMessage(e)`.
- **E-invoice content:** the numbers/series, the MISA lookup and the buyer field are untouched.
  - Labels are translated, but the legal identifier is kept next to the translation, e.g. "Tax authority code (Mã CQT)".
  - The e-invoice card title has a `tc("legal.vietnameseOnly")` tooltip.
- **Other legal hints:** the cashbook print button and "Tạo phiếu thu & In" have the same `legal.vietnameseOnly` hint.
- **Bank memo and MST:** the QR transfer memo `"{code} thanh toan no"` (a bank transfer content string) and "MST" are kept.
- **Print templates:** unchanged.

## CSV rule
- **Accounting/tax-relevant exports keep Vietnamese headers and values in every locale.** Accountants and tax books consume these, and tax/legal terms must match. File names are unchanged.
  - Invoice list (summary and detail), single-invoice export, sales returns, cash book (`so-quy`) and customer debt ledger (`cong-no-*`).
  - Their buttons have a tooltip saying the headers stay in Vietnamese.
- **Operational lists are translated** to the current locale: customer sales history, shipment list, partner list, order list and order lines.
- No COD reconciliation CSV exists in this area.

## Glossary (en / ja / zh)
**"Hóa đơn" choice:** in this app it means a POS sales slip, not a tax invoice.
- **zh:** 销售单. In China 发票 means a tax fapiao, so 发票 is used only for HĐĐT (电子发票) and purchase invoices (进项发票).
- **ja:** 売上伝票 (sales slip), as nav already uses. 請求書 means a bill or invoice requesting payment (B2B). 適格請求書 is Japan's own qualified-invoice system and does not apply. So HĐĐT is 電子インボイス.
- **en:** "Invoice", which matches KiotViet English.

| vi | en | ja | zh |
|---|---|---|---|
| Hóa đơn | Invoice | 売上伝票 | 销售单 |
| Hóa đơn điện tử (HĐĐT) | E-invoice | 電子インボイス | 电子发票 |
| CQT chấp nhận | Accepted by tax authority | 税務当局承認済み | 税务机关已接受 |
| Trả hàng | Returns | 返品 | 退货 |
| Hủy (chứng từ) | Cancel | 取消 | 作废 |
| Khách lẻ | Walk-in customer | 一般客 | 散客 |
| Khách cần trả / đã trả | Amount due / Customer paid | 請求額 / 入金額 | 应付金额 / 客户已付 |
| Công nợ | Debt / Receivables | 売掛金 | 欠款 / 应收欠款 |
| Sổ quỹ | Cash flow (nav) | 入出金 | 收支 |
| Phiếu thu / Phiếu chi | Receipt / Payment voucher | 入金伝票 / 出金伝票 | 收款单 / 付款单 |
| Quỹ / Tổng quỹ | Fund / All funds | 資金 / 全資金 | 资金 / 全部资金 |
| Hạch toán KQKD | Posted to P&L | 損益計上 | 计入损益 |
| Đặt hàng | Orders | 受注 | 预订单 |
| Phiếu tạm | Draft | 仮伝票 | 草稿单 |
| Đặt cọc | Deposit | 前受金 | 定金 |
| Vận đơn | Shipment | 配送伝票 | 运单 |
| Thu hộ (COD) | COD | 代引き | 代收货款 |
| Đối tác giao hàng | Delivery partner | 配送業者 | 配送合作方 |
| Đối soát | Reconcile | 照合 | 对账 |
| Người trả phí | Fee payer | 送料負担 | 运费承担方 |
| Nhóm khách hàng | Customer group | 顧客グループ | 客户分组 |
| Bảng giá chung | Default price book | 標準価格表 | 通用价格表 |
| Doanh thu thuần | Net revenue | 純売上 | 净营业额 |
| Tiền mặt / Chuyển khoản / Thẻ / Ví điện tử | Cash / Bank transfer / Card / E-wallet | 現金 / 振込 / カード / 電子マネー | 现金 / 转账 / 刷卡 / 电子钱包 |
| tr / tỷ (chart axis) | M / B | 百万 / 十億 | 百万 / 十亿 |

## Validation (frontend, no next build/dev)
- `node --experimental-strip-types --test tests/i18n-keys.test.mjs`: 22 of 23 tests pass, and every namespace in this area passes.
  - The only failure is `purchases.json`, which belongs to another area's agent and is still in progress.
- `npx tsc --noEmit -p .`: **0 errors in my area**.
  - The remaining errors are all in other agents' work in progress: `features/hr/**`, `app/(admin)/employees/**` (hr keys not yet added), and `messages/sale.ts` (`vi/sale.json` missing).
  - The lead should re-run tsc after all agents finish.
- `npx eslint` on the 81 changed or created files in this area: clean.
- All code files are under 200 lines (largest: debt-dialogs.tsx at 158).

## Files
- **Messages:**
  - `frontend/src/messages/{sales,customers,cashbook,orders,delivery,dashboard}.ts`
  - `frontend/src/messages/{vi,en,ja,zh}/{same}.json`
- **New:**
  - `features/sales/i18n-enum-label.ts`
  - `features/dashboard/dashboard-page-content.tsx`
  - `app/(admin)/{invoices,returns,customers,cashbook,orders,delivery}/layout.tsx`
- **Changed in `features/sales`:**
  - Invoice files: invoice-list-kit/pager/table/toolbar/prefs, invoice-filter-model/sidebar, invoice-time-filter, invoice-detail-panel/header/sections/footer, invoice-einvoice-card/state, invoice-tax-dialog.
  - Payment and shared files: qr-payment-dialog, refund-method-fields, customer-csv-export (CsvExportButton only), sales-types (comments only).
  - Customer files: customer-* (except customer-csv-export), debt-dialogs.
  - Cashbook files: cash-voucher-*.
- **Changed elsewhere:** `features/orders/*`, `features/delivery/*`, `features/dashboard/*`, and `app/(admin)/{page.tsx, invoices, returns, customers, customers/groups, cashbook, orders, delivery, delivery/shipments, delivery/partners}`.

## Shared requests (for lead / other agents)
1. **Selling screen (`/sale` layout):** preload `"customers"` (it uses `CustomerFormDialog`), `"delivery"` (fee-payer / shipment fields) and `"sales"` (`QrPaymentDialog`, `RefundMethodFields`, payment enums). Otherwise these show Vietnamese for a moment on first open.
2. **Key-based alternatives that other areas can switch to:**
   - `orderStatusLabel` → `t(ORDER_STATUS_KEY[s])` with `useT(ordersNs)`. Used by reports orders-report and sale-order-picker-dialog.
   - `FEE_PAYERS` → `FEE_PAYER_KEY` with `deliveryNs`. Used by sale-delivery-form.
   - `methodLabel` / `PAYMENT_METHODS` labels → `enumLabel(t, salesNs, "enums.paymentMethod", m)`. Used by the sale screen.
   - `shortMoney(v, t)`, where `t` is the dashboard t. Used by reports report-charts.
3. **Purchases (input-invoices page):** pass a translated `unit` to `ListPager`.
4. **Reports:** `PRESET_LABELS` / `PRESET_GROUPS` (`features/reports/report-time-presets`) are used by `invoice-time-filter.tsx` and are still Vietnamese. If the reports agent turns them into keys, invoice-time-filter must follow, and tsc will flag it.
5. **Error codes:** none new. `errors.json` and `common.json` are untouched.
6. **`settings/bank-accounts/page.tsx`:** it uses `QrPaymentDialog`. The settings layout should also preload `"sales"`.

## Concerns
- In delivery, the colons after labels are now added in code, so ja/zh show an ASCII ":". The fee-payer text now starts with a capital ("Cửa hàng trả").
- The dashboard audit line is "{user} vừa {action}{doc}". The action and feature come from the server in Vietnamese, so en/ja/zh show a mixed sentence such as "Admin: tạo hóa đơn HD0001". A real fix needs action codes from the backend.

## Unresolved questions
- ja/zh wording for "khách lẻ" (一般客/散客), "phiếu tạm" (仮伝票), 坊・社 (phường/xã) and 税番号 (MST) needs native review.
- Should the dashboard audit text be translated? That would need a backend action-code field.
