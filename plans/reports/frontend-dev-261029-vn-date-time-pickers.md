# Bộ chọn ngày/giờ kiểu KiotViet (dd/MM/yyyy, dd/MM/yyyy HH:mm 24h)

## Status: DONE_WITH_CONCERNS

## Components (frontend/src)
- `components/ui/date-picker.tsx`: `DatePicker({ value: string|null|undefined /*yyyy-MM-dd*/, onChange(ymd: string /* "" when cleared */), min?, max?, className?, disabled?, placeholder?, id?, title?, autoFocus?, "aria-label"? })`. It also exports `TodayButton` and `PickerInputProps`.
- `components/ui/date-time-picker.tsx`: `DateTimePicker({ value /* "yyyy-MM-ddTHH:mm" or ISO */, onChange(v /* "yyyy-MM-ddTHH:mm" local, or "" */), ...PickerInputProps })`. It has a calendar icon and a clock icon.
- `components/ui/time-picker.tsx`: `TimePicker({ value /*HH:mm*/, onChange(hm|""), ...PickerInputProps })`.
- `components/ui/date-range-picker.tsx`: `DateRangePicker({ value: {from,to}|null, onChange({from,to}), placeholder="Tùy chỉnh", className?, disabled?, min?, max?, "aria-label"? })`. A null value shows the placeholder. Its popup shows two months: the first click sets the start day, the second sets the end day, and the order is swapped automatically if needed.
- Shared parts: `month-calendar.tsx` (T2…CN header, «‹ › » navigation, arrow/PageUp/PageDown/Home/End keys), `time-list-panel.tsx`, `picker-popover.tsx` (Base UI Popover, `PickerFieldShell`).
- lib: `date-input-format.ts` (parse/format/mask/month grid), `use-masked-date-text.ts`, `zoom-aware-floating-anchor.ts`.
- Test: `frontend/tests/date-input-format.test.mjs`. All 6 pass.

`className` from the original input is applied to the outer frame (border, height, width), so field styles stay the same. Typing uses a mask; an invalid entry gets a red border (`data-invalid`, `aria-invalid`) and is not saved. Alt+↓ opens the popup.

## Zoom 1.12
I measured this in Chrome 145 with a file harness (esbuild + Tailwind compile in scratchpad, without touching the app): raw Floating UI placed the popup about 113px off horizontally and 76px vertically. The fix is a virtual anchor whose rect is divided by the zoom, plus `positionMethod="fixed"` and a `collisionBoundary` set to the viewport divided by the zoom. After the fix the popup sits exactly at field bottom + 4px, stays right-aligned (range is left-aligned), works when scrolled, flips upward near the bottom, and works inside a Dialog without closing it.
NOTE: the app's existing Select/DropdownMenu components (Base UI) run under the same zoom and are probably misaligned the same way. I did not touch them.

## Replaced usages: 33 files
audit-logs, lock, timesheets (popup now uses MonthCalendar), tax-location, attendance, employee-form, holiday, payroll-create, schedule-add, shift-form, tax-connection, stock-issue-editor, stock-take-line-table, **pos-checkout-panel**, price-book-form, product-filter-sidebar (range), product-form-sections, purchase-editor-panel, purchase-filter-sidebar (range), purchase-line-table, receipt-detail-panel, supplier-adjust, supplier-debt-doc, supplier-filter-sidebar (range), supplier-payment, finance-report (range), report-time-filter (Tùy chỉnh range + day + from/to time), cash-voucher, customer-form-fields, customer-list-filter-sidebar (range), debt-dialogs, **invoice-detail-panel**, **invoice-list-kit** (PeriodFilter range).
No `type="date|datetime-local|time"` remains in the code.

## Concerns
- Files in folders the lead later reserved were already edited before the message arrived (left as is): `features/pos/pos-checkout-panel.tsx`, `features/sales/invoice-detail-panel.tsx`, `features/sales/invoice-list-kit.tsx`.
- Not tested on the real app (:3010 is a production build, and I was not allowed to run dev/build). The lead needs to build and click through it.
- A field with an `e.target.value &&` guard (report filters, lock, price-book) snaps back to the old value when it is cleared, same as before.
