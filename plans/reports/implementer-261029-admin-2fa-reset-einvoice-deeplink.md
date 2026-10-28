# Admin đặt lại 2FA + deep link HĐĐT nhiều trạng thái — implementer report (2026-10-29)

**Status:** DONE

## 1. Admin resets another user's 2FA
Backend (identity-service, built + restarted alone):
- `POST /api/users/{id}/2fa/reset` body `{password?, code?}` → 204. Class-level `user.manage`.
- Rules (`user/UserTwoFactorResetService.java`), in order:
  1. target == caller → 400 `CANNOT_RESET_SELF` (use Tài khoản → Xác thực 2 lớp).
  2. target is store owner → 403 `OWNER_PROTECTED` (owner's 2FA only by owner, via existing `/api/auth/2fa/disable` with password + TOTP/recovery code).
  3. target 2FA not enabled → 400 `TOTP_NOT_ENABLED`.
  4. caller confirms via existing `TwoFactorService.confirmIdentity`: own TOTP if caller has 2FA on (password alone → 400 `TOTP_REQUIRED`), else own password (wrong → 400 `BAD_PASSWORD`). TOTP attempts count toward caller's 5-fail lockout.
  5. delete `user_totp` + `user_recovery_codes` of target, `revokeAllForUser(target)`, audit "Người dùng / Đặt lại xác thực 2 lớp / Đặt lại xác thực 2 lớp tài khoản {username}".
- Existing access JWT of target stays valid until expiry (same as reset-password); refresh is revoked.
- `UserResponse` + `twoFactorEnabled`, `owner` (list = 1 query `select user_id from user_totp where enabled`; get/update compute per-user; create=false). `/api/auth/me` nested user now carries the same value.
- `TwoFactorService`: `enabledUserIds()`, `reset(userId)`.

Frontend:
- `settings/users/page.tsx`: badge "Đã bật 2 lớp" next to username (`bg-primary/10 text-primary`).
- `user-form-dialog.tsx`: ghost button "Đặt lại xác thực 2 lớp" in footer (shown only if target has 2FA, not owner, not me) → `reset-two-factor-dialog.tsx` (asks own password, or own 2FA code if `me.twoFactorEnabled`; on success invalidates `["users"]`, closes both dialogs).
- `lib/use-current-user.ts`: `User.twoFactorEnabled?`, `User.owner?`.

### Manual recovery: owner lost phone + recovery codes (no endpoint by design)
Applies whenever the owner is locked out (incl. owner = only ADMIN). Requires server/DB access:
```sql
-- identity_db; replace <owner_username>
DELETE FROM user_recovery_codes WHERE user_id = (SELECT id FROM users WHERE username = '<owner_username>');
DELETE FROM user_totp          WHERE user_id = (SELECT id FROM users WHERE username = '<owner_username>');
UPDATE refresh_tokens SET revoked = true WHERE user_id = (SELECT id FROM users WHERE username = '<owner_username>');  -- check column name before running
```
e.g. `docker exec -it kiot_viet_clone-postgres-1 psql -U vaxclinic -d identity_db`. Verify identity of the requester out-of-band first (CCCD vs Hồ sơ cửa hàng), then owner logs in with password only and re-enables 2FA. Leave a note in Lịch sử thao tác manually if needed (DB path writes no audit row). Alternative when another ADMIN exists: owner can't be reset by them — transfer ownership is also owner-only, so DB is the only path.

## 2. E-invoice deep link
- `/store-profile/einvoice` "Xem danh sách hoá đơn" → `/invoices?einvoice=PUBLISHED,ACCEPTED`.
- `invoices/page.tsx`: reads `sp.getAll("einvoice").join(",")` → supports comma list and repeated params.
- `invoice-filter-model.ts`: `einvoiceStatus` may be CSV → split → repeated `einvoiceStatuses` (backend already `List<String>`).
- `invoice-filter-sidebar.tsx`: when value is multi, select shows an extra option labelled "Đã phát hành, CQT chấp nhận" (`einvoiceStatusesLabel` in `invoice-einvoice-state.ts`); picking a single status replaces it.

## Files
Backend: `backend/identity-service/src/main/java/com/vaxclinic/identity/user/{UserController,UserDtos,UserService,UserTwoFactorResetService(new)}.java`, `auth/twofactor/TwoFactorService.java`, `auth/AuthController.java`.
Frontend: `frontend/src/features/settings/{reset-two-factor-dialog(new),user-form-dialog}.tsx`, `app/(admin)/settings/users/page.tsx`, `lib/use-current-user.ts`, `app/(admin)/invoices/page.tsx`, `app/(admin)/store-profile/einvoice/page.tsx`, `features/sales/{invoice-filter-model.ts,invoice-filter-sidebar.tsx,invoice-einvoice-state.ts}`. Not touched: features/sale/**, product form.

## Tests
- `npx tsc --noEmit -p .` clean; eslint clean on all changed files.
- Scratchpad `e2e_2fa_reset.py`: **19/19 pass** — DTO flags, list/get badge data, wrong own password 400, target's password rejected, self-reset 400, non-owner admin vs owner 403, reset 204, secret+codes deleted, refresh revoked 401, login without code, flag off, audit row, second reset 400 TOTP_NOT_ENABLED, actor-with-2FA password-only 400 TOTP_REQUIRED, own TOTP 204, gateway unauth 401. Temp users deleted (audit rows kept intentionally).
- Invoice API accepts repeated `einvoiceStatuses` (200); local DB has 0 published/accepted invoices so union count not meaningfully verified.

## Unresolved questions
1. Should a non-ADMIN role holding `user.manage` be allowed to reset an ADMIN's 2FA? Currently yes (same as reset-password today).
2. Notify the target user (notification) after reset? Not done.
