# i18n phase 1 — report

Status: DONE_WITH_CONCERNS. Guide for phase 2: `plans/reports/i18n-guide.md`.

## Approach
Small in-repo solution, no library. Code lives in `frontend/src/lib/i18n/`:
- `locales.ts`: vi, en, ja, zh. ja and zh are marked beta. Also holds the cookie and storage key `vx_locale`.
- `translate.ts`: pure functions for key lookup, `{var}` interpolation, plural via `Intl.PluralRules` (`key_one` / `key_other`), and fallback (locale → vi → key).
- `message-store.ts`: module cache. Non-vi namespaces load lazily with `import()`, one chunk per JSON file. Missing keys are logged once, in dev only.
- `namespace.ts`: `createNamespace(name, viJson)`. vi is bundled through a static import, and keys are type-checked against the vi JSON.
- `use-t.ts`: `useT(ns)`.
- `i18n-provider.tsx`: `I18nProvider`, `I18nSeed`, `useLocale()`, `useSetLocale()`. The locale is saved to localStorage and the cookie, and `<html lang>` is updated.
- `server.ts` + `i18n-preload.tsx`: the server reads the cookie and sends the chosen locale's messages with the page. This avoids a flash of Vietnamese on reload. A `useSyncExternalStore` server snapshot keeps hydration consistent.
- `translate-api-error.ts` + `render-rich-text.tsx`: API error translation and placeholders that hold JSX.

Wiring:
- The root layout is now async. It reads the cookie, sets `<html lang>`, and preloads common, nav, notifications, auth and errors.
- The settings and store-profile layouts preload their own namespaces.

## Done
- **Namespaces:** common, nav, notifications, auth, errors (151 `codes` + 103 `codesWithDetail`), settings, store-profile.
- **App shell:**
  - Header and mega menu.
  - Account menu: new "Ngôn ngữ" item above "Chủ đề" showing the current language name, then the "‹ Chọn ngôn ngữ" panel with flags, ✓, and a "Bản thử nghiệm" group for 日本語 and 中文 (简体).
  - Theme colour names, notification bell, list and detail.
- **Login:** a real language picker replaces the static "🇻🇳 Tiếng Việt". Server errors are translated by code.
- **Other pages:** welcome page, store-access dialog and two-factor dialog.
- **components/ui:** calendar (month/year title and weekday names per locale), date, range, time and datetime pickers, ListEmptyState, SearchableSelect, VnAddressFields, dialog Close, DetailSingleTab.
- **API errors:** `errorMessage()` translates by `ApiError.code` when the locale is not vi. Dynamic messages show as "generic (original)". Validation details get a translated prefix.
- **Kept Vietnamese in every locale:**
  - Formats: VND, dd/MM/yyyy.
  - Content: Terms of Use text, legal e-invoice names, print template labels, business data.
  - Notes: `common.legal.vietnameseOnly` appears on print templates and e-invoice settings, and a note sits on the terms page.
- **Flags:** inline SVG (`components/layout/locale-flag-icon.tsx`).
- **Test:** `tests/i18n-keys.test.mjs` checks that every vi key exists in en/ja/zh, flags extra keys, checks that placeholders match, and unit-tests translate.

Checks: the key test passes 10/10 and the other node tests pass. `tsc --noEmit` is clean. eslint has 0 errors; the only warning is an `<img>` warning that was already there. `next build` was not run.

## Concerns / notes
- The root layout reading cookies makes every route dynamic, including /welcome and /login, which were static before.
- Places that load strings lazily can show Vietnamese for a moment on reload in en/ja/zh:
  - `StoreAccessGate`, which is mounted in providers.
  - The employees settings pages, which reuse settings components without preloading.
- No shared pager exists in components/ui. Keys are in `common.pager.*` for the feature pagers.
- Still untranslated and in phase-2 scope:
  - The accounting components on the tax settings page (TaxProfileCard, TaxSectorDialog).
  - QrPaymentDialog.
  - The print template editor and A5 preview.
  - `NativeSelect` in features/products.
- Changed shared functions:
  - `ListEmptyState`'s `what`/`period` props: callers must now pass translated text.
  - `WEEKDAYS_VI` was removed, since nothing used it any more.
  - The `Accent.label` field is no longer displayed.
- Fork C noted that ja/zh wording for some domain terms needs native review: "khách lẻ", "bảo lưu gian hàng", "phiếu tạm", "chốt bảng lương".
- The settings fork reports that the folder is inside a git repo (branch feature/phase-01-foundation). Nothing was committed.

## Unresolved questions
- Should the lead own `errors.json` in phase 2, or should backend agents add new codes to it directly?
