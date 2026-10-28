# Hộp thư đến (notification inbox) — report 2026-10-29

Status: DONE_WITH_CONCERNS (concerns at end)

## Backend
- common-lib: `common/notification/NotificationClient.java` (sync / publish / settings), `NotificationAutoConfiguration.java` (bean when `app.identity-url` set; registered in AutoConfiguration.imports).
- identity-service: migration `V7__notifications.sql` (notifications, notification_reads); package `notification/`:
  NotificationViewer, NotificationWriter (upsert/sync/resolve + daily cleanup), NotificationReader (list/unread/read/read-all), NotificationController, AnnouncementController.
- product-service `notification/StockAlertJob(+Controller)`: LOT_EXPIRING (≤ N days, setting), LOT_EXPIRED (còn tồn), LOW_STOCK (< min_stock, per branch). perm inventory.view.
- sales-service `notification/SalesAlertJob(+Controller)`: ORDER_DUE (DRAFT/CONFIRMED, expected_delivery_at < tomorrow), SHIPMENT_RETURNING. perm sales.perform.
- integration-service `notification/IntegrationAlertJob(+Controller)`: EINVOICE_FAILED (perm settings.manage, branch null), SEPAY_RECEIVED (only when SePay enabled, every minute, event, branch of payment_request, perm sales.perform). Added `app.identity-url` to its application.yml + IDENTITY_URL in docker-compose.
- gateway: identity route + `/api/notifications/**,/api/announcements/**`.
- Jobs: every 15 min + ~45–60 s after startup. Dedupe: dedupeKey per entity; open → update content (keeps read state); resolved but created today → reopen same row (≤1/day); else new. Sync resolves open alerts of the same types not in the payload.

## Endpoints
- `GET /api/notifications?tab=all|alert|update&page&size`, `GET /api/notifications/unread-count` → {count, alert, update}, `POST /api/notifications/{id}/read`, `POST /api/notifications/read-all?tab=`
- `GET|PUT /api/notifications/settings` {expiryAlertDays 1–365, default 30; PUT needs settings.manage}
- `GET|POST /api/announcements`, `PUT|DELETE /api/announcements/{id}` (settings.manage; link must be `/…` or http(s))
- internal (service JWT): `POST /internal/notifications` (list, idempotent by dedupeKey), `/internal/notifications/sync` {types, items}, `/internal/notifications/resolve` [keys], `GET /internal/notifications/settings`
- run now (each producer service port, `internal` or `settings.manage`): `POST /internal/notification-jobs/run`

## Frontend
- `components/layout/notification-bell.tsx` (bell + badge + 420px popover, tabs Tất cả/Cảnh báo/Cập nhật, đánh dấu đã đọc tất cả), `notification-list.tsx`, `notification-detail-dialog.tsx`, `notification-queries.ts` (30 s poll, paused when tab hidden; infinite scroll), `use-offline-unsynced-count.ts` (local row from localStorage `pos.queue`).
- `app-header.tsx`: only inserted `<NotificationBell />` + import.
- Settings: `app/(admin)/settings/notifications/page.tsx`, `features/settings/notification-settings-queries.ts`, `announcement-form-dialog.tsx`; nav item "Thông báo nội bộ" (Tiện ích, perm settings.manage) in settings-shell.tsx.
- Click row: mark read → link ?? docCodeHref(docCode); announcements / no-link → detail dialog.
- tsc (excluding pos) + eslint clean on my files. No next build run.

## Tests
`scratchpad/e2e_notifications.py` — 41 checks ALL PASSED: alerts created, per-branch, dedupe, read/unread per user, read state kept across re-runs, expiry setting resolves/reopens same row, validation, permission + branch filtering, announcements CRUD/403/unsafe link, read-all, gateway routing + /internal blocked, resolve on inactive/deleted product, ORDER_DUE create/resolve, EINVOICE_FAILED create/resolve, SePay alert + no dup. Cleans up (users/branch/role via psql).

## Concerns / unresolved
- features/pos was deleted mid-task by the POS agent → offline row reads localStorage key `pos.queue` directly; POS rebuild must keep that key (or update OFFLINE_QUEUE_KEY).
- e-invoice alerts use settings.manage per lead; actual retry permission is sales.perform and einvoice settings page is user.manage — adjust if desired.
- start-all-local.ps1 tried to start frontend (`next start`) several times while no .next build existed (failed harmlessly).
- Two real LOT_EXPIRED alerts exist from other agents' test products (SP000022, SP000026).
- SePay watermark is in memory (restart rescans 24 h; dedupe prevents duplicates).
