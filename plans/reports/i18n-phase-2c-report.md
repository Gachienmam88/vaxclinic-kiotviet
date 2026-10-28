# i18n phase 2c — report (sale, hr, reports)

Status: DONE_WITH_CONCERNS (all checks green; concerns = native review + 1 preload request for another area).

## Checks (run at the end, no other tsc/next build running)
- `npx tsc --noEmit -p .` → 0 errors (whole repo).
- eslint on all changed dirs/files → 0 problems.
- node tests: i18n-keys 24/24, sale-logic 8/8, sale-storage-migration 4/4, date-input-format 6/6, vn-admin-data 6/6.
- No next build/dev. Nothing committed.

## Namespaces
| ns | keys | preload |
|---|---|---|
| `sale` | 350 | new `app/sale/layout.tsx`: `["sale","sales","customers","delivery"]` (sale is outside `(admin)`; customer form, QR, delivery labels come from those areas → no flash for cashier on F5) |
| `hr` | ~560 | new `app/(admin)/employees/layout.tsx`: `["hr","settings"]` (fixes phase-1 concern: employees settings pages reuse settings components); new `app/cham-cong/layout.tsx`: `["hr"]`; /cham-cong tab title via `generateMetadata` from cookie locale |
| `reports` | — | `app/(admin)/reports/layout.tsx` now server: `["reports","orders","dashboard"]` around client `ReportMountGate` (old mount gate moved to `features/reports/report-mount-gate.tsx`) |

## Rules decided
- **Excel import template (sale):** column headers stay EXACTLY Vietnamese (`IMPORT_COLUMNS` untouched; parser matches them). Only dialog text translated; dialog adds hint "keep the Vietnamese column headers". Error messages translated but quote the Vietnamese column names (`Row 3: missing "Mã hàng"`).
  Pure parse/map functions take an optional message fn (`ImportParseMsg` / `ImportMapMsg`); default = built-in Vietnamese (mirrors `vi/sale.json → import.errors.*`) so node tests run unchanged.
- **Spoken amount (Web Speech):** speaks translated sentence with a voice of the UI language if the device has one; else Vietnamese sentence + vi voice (`speakPaid(amount, locale, text)`).
- **Shortcut drawer:** `SHORTCUT_HELP` now `[key, i18nKey]`, translated at render.
- **New tab names** ("Hóa đơn 1", "Đặt hàng 2", "Trả hàng 3", "Trả hàng / HD…", "Sao chép HD…") are created in the current language and saved with the tab (draft data). "Update_HDxxx" kept as is.
- **Printed/legal stays Vietnamese:** invoice/receipt print templates, receipt voucher category "Thu Tiền khách trả", e-invoice content (hint `common.legal.vietnameseOnly` added to the HĐĐT box/dialog and print-template button).
- **Reports:** UI, filters, on-screen paper titles/headers, CSV headers and print follow the locale. Business data, VND, dd/MM/yyyy untranslated; CSV file names keep Vietnamese slugs.
  Exception: finance report "Báo cáo kết quả hoạt động kinh doanh" line names in en/ja/zh = translation + Vietnamese original (screen/print: small grey bracket; CSV: "Translated (Vietnamese)"); vi shows Vietnamese only.
- **HR:** commission CSV export headers stay Vietnamese (file is re-imported); other HR CSV exports follow locale. Mobile clock-in: non-vi shows translated "Clocked in/out" instead of server Vietnamese `r.message`.

## Coordinator requests handled
- /sale preloads `customers`, `delivery`, `sales`.
- Sale order picker + reports order report use `ORDER_STATUS_KEY` + `ordersNs` (removed `reports.orderStatus.*`).
- Sale delivery form uses `FEE_PAYER_KEY` + `deliveryNs`; sale payment methods use `enumLabel(t, salesNs, "enums.paymentMethod", m)` via `usePaymentMethodLabel()` in `sale-ui-parts.tsx` (only own key left: short radio label "Ví").
- Report charts use `shortMoney(v, tDashboard)`.
- `PRESET_LABELS` removed and `PRESET_GROUPS.title` dropped; `features/sales/invoice-time-filter.tsx` now uses `reportsNs` `presets.*` / `presetGroups.*`.
- `features/products/price-book-resolver.ts`: `warning` is now `{ code: BOOK_MISSING | BOOK_NOT_APPLICABLE | NOT_IN_BOOK_BLOCKED | NOT_IN_BOOK, book? }`; sale translates via `priceWarningText(t, w)` (`sale.priceBook.warnings.*`). Callers updated (add-product, cart, cart-line, repriceLines). No node test referenced the old strings.

## Files
- Created: `messages/{sale,hr,reports}.ts`, `messages/{vi,en,ja,zh}/{sale,hr,reports}.json`, `app/sale/layout.tsx`, `app/(admin)/employees/layout.tsx`, `app/cham-cong/layout.tsx`, `features/reports/report-mount-gate.tsx`.
- Modified: 49 files in `features/sale/`, 39 in `features/hr/`, all of `features/reports/`, 12 pages in `app/(admin)/employees/`, `app/cham-cong/page.tsx`, `app/(admin)/reports/layout.tsx`, `features/products/price-book-resolver.ts`, `features/sales/invoice-time-filter.tsx`.
- Signature changes, all in-area: `addProductToTab(t, …)`, `deliveryProblem(t, d)`, `returnProblem(t, …)`, `submitReturnDoc(t, …)`, `openPicked(…, what, t)`, `draftFromInvoice/draftCopyOfInvoice/draftFromOrder(…, t)`, `importInvoiceWorkbook(…, t)`, `repriceLines(…, t)`; HR: `salaryTypeLabel(t, …)`, `statusLabel(t, …)`, `unitLabel(t, …)`, `weekLabel(t, …)`; reports column builders take `t`.

## Glossary (vi → en / ja / zh)
| vi | en | ja | zh |
|---|---|---|---|
| Bán nhanh / thường / giao hàng | Quick / Standard / Delivery sale | クイック / 通常 / 配送販売 | 快速 / 普通 / 配送销售 |
| Khách lẻ | Walk-in customer | 一般客 | 散客 |
| Khách cần trả / Khách thanh toán | Amount due / Amount paid | お支払い金額 / お預かり | 应付金额 / 客户付款 |
| Tiền thừa trả khách | Change | お釣り | 找零 |
| Tính vào công nợ | Added to debt | 売掛金に計上 | 计入欠款 |
| Thu hộ (COD) | Cash on delivery (COD) | 代金引換 | 代收货款 |
| Đặt cọc | Deposit | 前受金 | 定金 |
| Bảng giá (chung) | (General) price book | (標準)価格表 | (通用)价格表 |
| Kênh bán / Người bán | Sales channel / Seller | 販売チャネル / 販売担当 | 销售渠道 / 销售员 |
| Phiếu thu | Receipt | 入金伝票 | 收款单 |
| Trả hàng / Trả nhanh | Return / Quick return | 返品 / クイック返品 | 退货 / 快速退货 |
| Đồng bộ phiếu (offline) | Sync documents | 伝票を同期 | 同步单据 |
| Lô / HSD | Lot / Expiry | ロット / 使用期限 | 批次 / 有效期 |
| HĐĐT | E-invoice | 電子請求書 | 电子发票 |
| Bảng chấm công / Chấm công | Timesheet / Clock in | 勤怠表 / 打刻 | 考勤表 / 打卡 |
| Ca làm việc / Lịch làm việc | Shift / Work schedule | シフト / 勤務スケジュール | 班次 / 排班 |
| Bảng lương / Phiếu lương / Chốt lương | Payroll / Payslip / Finalize | 給与表 / 給与明細 / 確定 | 工资表 / 工资条 / 锁定 |
| Hoa hồng / Tạm ứng | Commission / Salary advance | コミッション / 前払い | 提成 / 预支 |
| BHXH / Thuế TNCN | Social insurance / Personal income tax | 社会保険 / 個人所得税 | 社会保险 / 个人所得税 |
| Phụ cấp / Giảm trừ / Thưởng | Allowances / Deductions / Bonus | 手当 / 控除 / 賞与 | 津贴 / 扣款 / 奖金 |
| Báo cáo cuối ngày | End-of-day report | 日次締めレポート | 日结报表 |
| Doanh thu thuần / Giá vốn / Lợi nhuận gộp | Net revenue / COGS / Gross profit | 純売上 / 売上原価 / 粗利益 | 净营业额 / 成本 / 毛利润 |
| Báo cáo KQHĐKD | Income statement | 損益計算書 | 经营成果报表 |

## Shared requests (for the lead)
- No new `common` keys, no new backend error codes needed.
- `features/sales/invoice-time-filter.tsx` now reads `reportsNs` → the invoices route layout (sales area) should add `"reports"` to its `I18nPreload` to avoid a brief Vietnamese flash of the time presets.
- Optional backend: give codes to `/hr/clock` success messages and schedule / time-clock import errors (shown in Vietnamese now).
- `use-sale-lookups` fallback channel name "Bán trực tiếp" and server channel names are data (untranslated).

## Unresolved questions
- Native review of ja/zh: POS terms (お預かり, 一般客, 前受金), HR (仮計算/暂算, 確定/锁定), finance report line names, 日次締め.
