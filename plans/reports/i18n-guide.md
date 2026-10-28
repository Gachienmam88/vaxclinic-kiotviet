# i18n guide — VaxClinic frontend

Locales: `vi` (source + default), `en`, `ja`, `zh` (ja/zh shown under "Bản thử nghiệm"). In-repo solution, no library.
Infra: `frontend/src/lib/i18n/` (do NOT edit in phase 2 — ask the lead). Messages: `frontend/src/messages/`.

## 1. Layout
```
src/messages/<ns>.ts                 # namespace definition (imports vi JSON statically → typed keys, vi bundled)
src/messages/vi/<ns>.json            # source strings (Vietnamese)
src/messages/{en,ja,zh}/<ns>.json    # same keys, lazy-loaded chunk per file (import() on demand)
```
Existing namespaces (phase 1): `common`, `nav`, `notifications`, `auth`, `errors`, `settings`, `store-profile`.
Phase-2 areas create their own: `products`, `purchases`, `inventory`, `sales`, `orders`, `delivery`, `customers`,
`cashbook`, `reports`, `hr`, `sale` (selling screen), `accounting`, `dashboard`, `print` (UI around printing only), …
One namespace per feature area; a big area may split (`reports-sales`, `reports-stock`) — kebab-case file name.

## 2. Adding a namespace (area agent)
```ts
// src/messages/products.ts
import { createNamespace } from "@/lib/i18n/namespace";
import vi from "./vi/products.json";
export const productsNs = createNamespace("products", vi);   // name === file name
```
Create `vi/en/ja/zh/products.json` with identical key trees. Preload it for the first page load (no Vietnamese flash
on F5 for en/ja/zh) in the area's **server** `layout.tsx` (create one inside your own route folder if missing):
```tsx
import { I18nPreload } from "@/lib/i18n/i18n-preload";
export default function Layout({ children }: { children: React.ReactNode }) {
  return <I18nPreload namespaces={["products"]}>{children}</I18nPreload>;
}
```
Routes outside the `(admin)` tree (e.g. `/sale`) do the same in their own `layout.tsx`. Never edit `app/layout.tsx`.

## 3. Using strings (client components)
```tsx
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { productsNs } from "@/messages/products";

const t = useT(productsNs);           // keys are type-checked against vi JSON
const tc = useT(commonNs);            // shared buttons / statuses
t("list.title");
t("detail.stockOf", { name: p.name }); // "{name}" interpolation (values inserted raw — format numbers yourself)
t("list.selected", { count: n });      // plural: keys "selected_one" (en only) + "selected_other"; call with base key
tc("actions.save");
```
- `t` is stable per (locale, namespace) → safe in `useMemo`/`useEffect` deps.
- Missing key → falls back to Vietnamese, then to the key itself; dev console warns once per key.
- `useLocale()` gives the current `Locale` if a component must branch (rare). `useSetLocale()` only for the language menu.
- Module-level label arrays/maps: store **keys**, translate at render:
  ```ts
  const TABS = [{ id: "info", label: "tabs.info" }, { id: "stock", label: "tabs.stock" }] as const;
  // render: t(tab.label)
  ```
  Non-React helpers that produce UI text should take a `t` argument (`type TFunction` from `@/lib/i18n`).
- Sentences with embedded elements (bold, links, buttons): keep ONE key with `{placeholders}` and render with
  `renderRichText(t("rename.summary"), { from: <b>{a}</b>, to: <b>{b}</b> })` from `@/lib/i18n/render-rich-text`
  (call `t` without vars so `{from}` stays in the string). Word order differs in ja/zh — never concatenate fragments.
- Do not put strings in `common` from phase 2; if something is genuinely shared, use your namespace and tell the lead.
- Shared components already translate their own defaults (pickers, calendar month/weekday names, `ListEmptyState`,
  `SearchableSelect`, `VnAddressFields`, dialog close button, `DetailSingleTab`). Props you pass are shown as-is, so
  pass translated text: `<ListEmptyState what={t("list.emptyWhat")} period={t("list.thisMonth")} />` (sentence order
  is handled by `common.emptyState.*`; `what` is a plain noun — "hàng hóa" / "products" / "商品").
- There is no shared pager component; feature pagers live in features/* — use `common.pager.*`
  (`range: "{from} - {to} of {total}"`, `prev`, `next`, `first`, `last`, `perPage`) instead of new keys.
- Province/ward names (`vn-admin-data`) are data and stay Vietnamese.

## 4. Key naming
- Nested JSON, camelCase segments: `<screen-or-component>.<element>` e.g. `list.title`, `form.fields.name`,
  `form.errors.nameRequired`, `toast.saved`, `confirmDelete.title`, `confirmDelete.body`.
- Keys describe meaning, not the Vietnamese text. No dots inside segments; values are strings only (no arrays).
- Placeholders `{camelCase}`; the key test enforces the same placeholder set in every locale.
- Plural suffixes `_one`, `_other` (en needs both; vi/ja/zh only `_other`). Only for `{count}`.

## 5. What changes and what stays Vietnamese
Translate: all UI chrome — labels, buttons, headings, placeholders, tooltips, aria-labels, toasts, confirm dialogs,
empty states, client-side validation messages, enum/status labels defined in the frontend.

Keep Vietnamese in every locale (do not translate):
- Money/number/date formats: `lib/format.ts`, `dd/MM/yyyy`, VND — unchanged for all locales.
- Print templates & printed documents, invoices, e-invoice (HĐĐT) content, tax books (S1a-HKD, S2a-HKD, …),
  Điều khoản sử dụng (terms of use), legal names of documents/forms. Add a note where users might be surprised:
  `tc("legal.vietnameseOnly")` (common) as a tooltip/hint near the print/e-invoice/tax-book entry point.
- Business data: product/customer/supplier names, branch names, notes, server-generated notification text.
- Vietnamese tax/legal identifiers (S1a-HKD, "Mẫu số 01GTKT", MST) inside translations stay as-is.
- Backend error text is translated centrally (see §6) — do not translate `errorMessage(e)` yourself.

## 6. API errors
`errorMessage(e)` (`lib/api-client.ts`) already translates by `ApiError.code` when locale ≠ vi, using
`messages/<locale>/errors.json`:
- `codes.<CODE>` — fixed message → replaced.
- `codesWithDetail.<CODE>` — backend message has dynamic parts → shown as `Translation (original message)`.
- Unknown code → server message. If you add a new backend code, add it to all 4 `errors.json` (lead-owned file in
  phase 2: send the code list to the lead instead of editing).

## 7. Translation quality
- English: natural, concise retail/clinic/accounting wording (KiotViet English UI is a good reference):
  "Hàng hóa" → Products, "Nhập hàng" → Purchase orders / Goods receipt, "Kiểm kho" → Stock take,
  "Sổ quỹ" → Cash flow, "Công nợ" → Debt, "Chi nhánh" → Branch, "Tồn kho" → Stock on hand, "Lô/HSD" → Lot/Expiry.
- ja: 商品, 仕入れ, 棚卸, 在庫, 店舗(=Chi nhánh), 顧客, 仕入先, 入出金(=Sổ quỹ), 売掛金/買掛金, 請求書(=Hóa đơn), ロット/使用期限.
- zh (简体): 商品, 进货, 盘点, 库存, 门店(=Chi nhánh), 客户, 供应商, 收支(=Sổ quỹ), 应收/应付, 发票/销售单(=Hóa đơn), 批次/有效期.
- Vaccine domain: vắc xin → vaccine / ワクチン / 疫苗; mũi tiêm → dose / 接種回 / 剂次; tiêm chủng → vaccination / 予防接種 / 接种.
- Keep UI short: ja/zh labels should not be longer than the Vietnamese ones.

## 8. Checks before handing back
```
cd frontend
node --experimental-strip-types --test tests/i18n-keys.test.mjs   # all vi keys exist in en/ja/zh, same {vars}
npx tsc --noEmit -p .                                              # wrong keys are type errors
npx eslint <changed files>
```
Do not run `next build` / `next dev` (lead builds). Files < ~200 lines (JSON exempt), kebab-case.
