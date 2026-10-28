# Accent theme "Chủ đề" — report (2026-10-29, rev 2: chrome-only per lead)

## Model
- `--primary` FIXED #0070f4 (content: tables, buttons, links, empty states, side-nav, charts, dialogs, ring, checkbox accent-color).
- New `--chrome` (default #0070f4) set by theme → tokens `chrome`, `chrome-active` (×0.8: #005ac3 / purple #7c4792), `chrome-hover` (×0.875).
- Persistence: localStorage only (`kv-accent:<userId>` = hex, `kv-accent-user` = last user), try/catch. No backend endpoint (accepted).

## Files
- New: `src/lib/accent-theme.ts` (palette, read/apply/save/sync, ACCENT_BOOT_SCRIPT → sets --chrome),
  `src/components/layout/accent-theme-sync.tsx` (mounted in AppHeader + SaleHeader),
  `src/components/layout/account-menu-theme-item.tsx` ("Chủ đề" item + 3×3 tile panel, ✓ on selected),
  `src/components/layout/account-menu-sub-panel.tsx` (reusable "‹ title" panel for language item).
- `app/layout.tsx`: pre-paint inline script in <head> (skips /login, /welcome), `suppressHydrationWarning` on <html>.
- `app/globals.css`: --chrome + chrome tokens; derived content tokens primary-active/hover/soft/tint-strong/tint/tint-light (fixed blue); `--ring: var(--primary)`; native checkbox/radio accent-color = primary.
- `account-menu-dropdown.tsx`: subpanel class (hide other items when [data-account-subpanel] present); avatar circles → chrome.
- Chrome usages: admin nav bar (`app-header.tsx` bg-chrome), nav pill hover/active (`app-header-nav-menu.tsx` bg-chrome-active), "Bán hàng" text/icon (text-chrome), avatar; sale top bar (`sale-header.tsx`), active tab icon (`sale-invoice-tabs.tsx`), THANH TOÁN/ĐẶT HÀNG/LƯU ĐƠN (`sale-checkout-panel.tsx`) + TRẢ HÀNG (`sale-return-checkout.tsx`) bg-chrome hover:bg-chrome-hover.
- Hex → token cleanup in ~59 content files (e.g. bg-[#e3f0fc] → bg-primary-tint, #0062d6 → primary-hover); since --primary is fixed these render the same blue (color-mix values ≈ original hex). Kept as tidy-up, no visual change intended.

## Untouched
- doc-code-link colours; notification bell red badge (#e5372c); semantic/status colours; pie colours; print CSS; QR panel #004a9f; logo text #0a2540; login/welcome; .dark block. No floating chat bubble exists in app.

## Validation
- `npx tsc --noEmit -p .` clean; eslint clean on changed files. No build/visual check.

## Unresolved questions
- Nav dropdown panel (white) link highlight + bell panel tab underline stay blue — confirm vs KiotViet if needed.
