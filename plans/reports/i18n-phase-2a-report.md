# i18n phase 2a — products / inventory / purchases / input invoices / accounting / print

Status: DONE_WITH_CONCERNS

## Summary
- New namespaces: `products`, `inventory`, `purchases`, `accounting`, `print`. Each has a `messages/<ns>.ts` file plus vi/en/ja/zh JSON files.
- New layouts (server, `I18nPreload`):
  - `products` preloads [products, purchases]
  - `inventory` preloads [inventory, purchases, products]
  - `purchases` preloads [purchases]
  - `accounting` preloads [accounting]
- Checks:
  - `node --experimental-strip-types --test tests/i18n-keys.test.mjs` passes 24/24. The test already loops over every namespace, so it did not need changes.
  - `npx tsc --noEmit -p .` shows 0 errors in my area. All remaining errors are in hr / employees: `commissionGrid.*` and `employeeForm.*` keys are missing from the hr namespace, which another agent is still working on.
  - eslint on all my folders plus `src/messages`: 0 errors, 0 warnings.
  - `next build` was not run.
- Nothing committed by me. Fork A noticed an auto commit `5614bca auto: update purchases.json` from some background process. It was not created by us.

## Rules applied
- **CSV headers.** Vietnamese is kept in three cases:
  - Tax and accounting exports: the tax declaration, the S1a/S2a/S2b/S2d/S2e-HKD books, the input-invoice export and the supplier debt ledger.
  - Files that get re-imported, because their parsers match Vietnamese header names: the price-book export and import (`parsePriceCsv` looks for "mã hàng" and the book name), and the supplier list export and import template (backend `SupplierImportService`).
  - Every other export is translated, with `t` passed into the helper: the receipts list, returns list, receipt lines, supplier history, and the stock take / write-off / internal-use lists and lines.
  - Hints in en/ja/zh tell users to keep the Vietnamese headers.
- **Kept Vietnamese:**
  - Printed document content: templates, sample data, amount in words.
  - Tax-book content: titles, columns, "Cộng", "Diễn giải".
  - `Period.label` inside the books and CSVs. The screens use `periodLabel(t)` instead.
  - Legal names and codes: S1a-HKD, 01/CNKD, MST, KCT/KKKNT.
  - Business data, including the note auto-filled when a receipt is created from an input invoice, and the "Chi Tiền trả NCC" voucher category.
  - VND and dd/MM/yyyy formats.
- **`tc("legal.vietnameseOnly")` hint** was added in three places:
  - the print template editor (under the preview)
  - an Info icon next to the accounting book tabs
  - a tooltip on the "Phát hành HĐĐT" button
- **Module-level label maps** now store keys:
  - `DOC_TYPE_LABEL` became `products.docTypes.*`.
  - `MISSING_POLICY_LABEL` and `FORMULA_BASE_LABEL` became the arrays `MISSING_POLICIES` / `FORMULA_BASES` plus `missingPolicy.*` / `formulaBase.*` keys.
  - `TAKE_STATUS_LABEL` / `ISSUE_STATUS_LABEL` became `*_KEY`.
  - `RECEIPT_STATUS_LABEL` / `RETURN_STATUS_LABEL` became `receiptStatusLabels(t)` / `returnStatusLabels(t)`.
  - `SUPPLIER_COLUMNS` labels are now keys.
  - The print field labels became `print.fields.*`. `PRINT_DEFS` entries are now `[fieldCode, labelKey]`, plus a new `groupKey`.
  - Nothing outside my area used the removed constants (checked with grep).
- **Signature changes:**
  - `promptCreateCategory(qc, promptText)`
  - the inventory and purchase CSV exporters take `t` (and `tc`)
  - `PrintButton` defaults its label to `tc("actions.print")`

## Files
- Created:
  - `src/messages/{products,inventory,purchases,accounting,print}.ts`
  - `src/messages/{vi,en,ja,zh}/{products,inventory,purchases,accounting,print}.json`
  - `src/app/(admin)/{products,inventory,purchases,accounting}/layout.tsx`
  - `src/features/accounting/accounting-labels.ts`
- Modified:
  - `src/features/products/*`: 20 files. `price-book-resolver.ts`, `price-book-csv.ts` and `product-form-state.ts` were left unchanged.
  - `src/features/print/print-button.tsx`, `print-template-editor.tsx`, `print-template-defaults.ts`
  - `src/features/inventory/*`: 12 files
  - `src/features/purchases/*` and `src/features/integrations/*`: 30 files
  - `src/features/accounting/*`: 8 files
  - all pages under `src/app/(admin)/{products,inventory,purchases,accounting}`

## Glossary (vi → en / ja / zh)
| vi | en | ja | zh |
|---|---|---|---|
| Hàng hóa | Products | 商品 | 商品 |
| Nhóm hàng | Category | 商品グループ | 商品分类 |
| Đơn vị tính / quy đổi | Units / Conversion rate | 単位 / 換算値 | 单位 / 换算值 |
| Giá vốn / Giá bán / Giá chung | Cost / Sale price / Base price | 原価 / 販売価格 / 基本価格 | 成本价 / 售价 / 基础价格 |
| Giá nhập cuối | Last purchase price | 最終仕入価格 | 最近进价 |
| Bảng giá / Thiết lập giá | Price book / Price setup | 価格表 / 価格設定 | 价格表 / 价格设置 |
| Tồn kho | Stock on hand | 在庫 | 库存 |
| Định mức tồn | Stock limits (min/max) | 在庫基準 | 库存定额 |
| Thẻ kho | Stock card | 在庫台帳 | 库存卡 |
| Lô / Số lô | Lot / Lot number | ロット / ロット番号 | 批次 / 批号 |
| Hạn sử dụng / cận hạn / hết hạn | Expiry date / near expiry / expired | 使用期限 / 期限間近 / 期限切れ | 有效期 / 临期 / 已过期 |
| Khách đặt | Reserved | 顧客予約 | 客户预订 |
| Vị trí | Location | 保管場所 | 位置 |
| Ngừng / Cho phép kinh doanh | Discontinue / Re-activate | 販売停止 / 販売再開 | 停售 / 恢复销售 |
| Nhập hàng (phiếu nhập) | Goods receipt | 仕入（仕入伝票） | 进货（进货单） |
| Trả hàng nhập | Purchase return | 仕入返品 | 进货退货 |
| Nhà cung cấp / Nhóm NCC | Supplier / Supplier group | 仕入先 / 仕入先グループ | 供应商 / 供应商分组 |
| Nợ cần trả NCC | Payable to supplier | 仕入先買掛金 | 应付供应商款 |
| Phân bổ | Allocate | 配分 | 分摊 |
| Phiếu tạm / Lưu tạm | Draft / Save draft | 一時保存 | 草稿 / 暂存 |
| Hoàn thành / Đã hủy | Completed / Cancelled | 完了 / 取消済み | 已完成 / 已作废 |
| Kiểm kho | Stock take | 棚卸 | 盘点 |
| Đã cân bằng kho | Balanced | 在庫調整済み | 已平衡库存 |
| Lệch tăng / giảm | Qty over / short | 増加数 / 減少数 | 盘盈 / 盘亏数量 |
| Xuất hủy | Write-off | 廃棄 | 报损 |
| Xuất dùng nội bộ | Internal use | 社内使用 | 内部领用 |
| Chuyển hàng đi / nhận | Transfer out / in | 移動出庫 / 移動入庫 | 调出 / 调入 |
| Hóa đơn đầu vào | Input invoices | 仕入請求書 | 进项发票 |
| HĐĐT / Phát hành | E-invoice / Issue | 電子請求書 / 発行 | 电子发票 / 开具 |
| Cơ quan Thuế | Tax authority | 税務当局 | 税务机关 |
| Mã số thuế | Tax code | 税番号 | 税号 |
| Kê khai thuế / Hồ sơ kê khai | Tax declaration / Declaration profile | 税務申告 / 申告プロファイル | 纳税申报 / 申报档案 |
| Hộ kinh doanh | Household business | 個人事業者 | 个体工商户 |
| Ngành nghề (thuế) | Business sector | 業種 | 行业 |
| Thuế GTGT / TNCN | VAT / PIT | 付加価値税 / 個人所得税 | 增值税 / 个人所得税 |
| Nhóm doanh thu | Revenue group | 売上区分 | 收入组别 |
| Địa điểm kinh doanh | Business location | 事業所 | 经营地点 |
| Sổ quỹ | Cash flow | 入出金 | 收支 |
| Mẫu in | Print template | 印刷テンプレート | 打印模板 |
| Phiếu thu / Phiếu chi | Receipt voucher / Payment voucher | 入金伝票 / 出金伝票 | 收款单 / 付款单 |

## Shared requests for the lead
1. `app/(admin)/settings/layout.tsx`: add `"accounting"` and `"print"` to the preload list.
   - `/settings/tax` uses TaxProfileCard, TaxSectorDialog and TaxLocationDialog, and its save toast now comes from the `accounting` namespace.
   - `/settings/print-templates` uses PrintTemplateEditor and A5Preview.
2. `app/(admin)/settings/print-templates/page.tsx` (settings-owned): it still shows the Vietnamese `PRINT_DEFS[pt].label` / `.group`. Switch it to `useT(printNs)`:
   - `t(\`types.${pt}\`)` for the type label
   - `t(\`groups.${PRINT_DEFS[pt].groupKey}\`)` for the group heading; keep grouping by `groupKey`
   - pass the same translated label to `printTemplates.tabTitle`
   - the sample branch name "Chi nhánh trung tâm" is print data and can stay Vietnamese
3. Preload `"purchases"` in other routes that use purchase components: the sales invoice detail uses `EInvoiceStatus`. `products` and `inventory` already preload it.
4. `features/products/price-book-resolver.ts` is used by the sale screen (another area). It returns Vietnamese `warning` strings. Proposal: return a warning code plus the book name, and let the sale agent translate it. I did not change it, because that would break their callers and the node tests.
5. No new error codes and no new `common` keys.
6. Lead note (1) is already handled: input-invoices passes `unit={t("inputInvoices.unit")}` to the sales `ListPager`. Note (2) is resolved: `purchases.json` was still being written at the time; the key test now passes 24/24.

## Concerns
- Some ja/zh wording needs native review:
  - tax terms: 個人事業者, 売上区分, 収入组别
  - debt and allocation terms
  - 一時保存 / 草稿 for "phiếu tạm"
- Components from other areas used inside my screens show their own text: the sales `PeriodFilter`, `ListPager`, `PageTitle`, `ListSearch`, `CsvExportButton` and `StatusBadge`.
- Fork A scripts saved some files with LF line endings. Git normalises this, so it is harmless.

## Unresolved questions
- Should the tax-book `Period.label` strings ("Tháng 3", "Quý 2") also be translated in the CSV files? Right now they stay Vietnamese because the books are legal documents.
