# Account menu + 2FA + Hồ sơ cửa hàng — implementer report (2026-10-29)

**Status:** DONE_WITH_CONCERNS (concerns = legal citations need expert verification; see end)

## Summary
Account dropdown (2FA status, Hồ sơ cửa hàng, `extraItems` slot, Đăng xuất), TOTP 2FA end-to-end (identity + BFF/login), store owner concept, `/store-profile` area (Thông tin gian hàng + Lịch sử cập nhật, update/phone/rename/transfer/pause flows, Hóa đơn điện tử packages, Quản lý chữ ký số, Điều khoản sử dụng + forced acceptance), gateway pause (423) + session cutoff (401). Language/theme items NOT built (lead scope change) — insert via `<AccountMenuDropdown extraItems={...} />`. Only `primary` tokens used for blue.

## Backend
identity-service (migration `V8__store_owner_2fa_terms.sql`: `users.owner` + unique partial index, `user_totp`, `user_recovery_codes`, `terms_acceptances`)
- `auth/twofactor/` TotpAlgorithm (RFC 6238 SHA1/6/30s, ±1 step, no reuse via last_step), TotpSecretCipher (AES-256-GCM; key = HMAC(ENCRYPTION_KEY→fallback JWT secret, label) — same derivation style as ClockTokenService; recovery codes = HMAC-SHA256), TotpVerifier (REQUIRES_NEW tx; 5 wrong → locked 5 min, 429), TwoFactorService, TwoFactorController.
- AuthService.login(username, password, code): 2FA on + no code → 401 `TOTP_REQUIRED`; wrong → 400 `TOTP_INVALID` (400 so BFF proxy doesn't refresh+retry). `/api/auth/me` adds `twoFactorEnabled`, `storeOwner`.
- `storeprofile/` StoreProfileModels, StoreProfileService (profile in app_settings `owner_profile`; email/phone/address written into existing `store` key — no duplication), StoreOwnershipService (ensureOwner on startup, rename, transfer, pause/reopen), StoreStatusService (public `/api/auth/store-status`; pause computed from date → auto-reopen without job), StoreActionVerifier (step "Xác thực": TOTP if 2FA on else password → 10-min HMAC token bound to user+purpose), StoreProfileController.
- `terms/TermsController` CURRENT_VERSION "1.0", effective 2026-11-01.
- SettingsController.saveStore: access code can no longer change there (400 `ACCESS_CODE_LOCKED`) and is always written explicitly (renaming the shop no longer silently changes the derived login code). UserService.update: owner can't be locked / lose ADMIN (`OWNER_PROTECTED`). StoreAccessController.accessCodeOf → public. RefreshTokenRepository.revokeAll, AppUserRepository.findFirstByOwnerTrue.
- application.yml: public path `/api/auth/store-status`, `app.totp.secret: ${ENCRYPTION_KEY:${JWT_SECRET}}`.

integration-service (`V3__einvoice_packages_and_digital_certificates.sql`)
- `storeprofile/` EInvoicePackageAllocator (published records per day → soonest-expiring covering package; overflow = unallocated), EInvoicePackageController, CertificateFileParser (CertificateFactory X.509, DER/PEM, MST from subject UID, rejects "PRIVATE KEY"/non-X.509, ≤20KB), DigitalCertificateController, CertificateExpiryAlerts (type `CERT_EXPIRING`, sync via existing NotificationClient → identity `/internal/notifications/sync`, every 6h + after each change; ≤30 days or expired, active, not revoked; permission settings.manage; link `/store-profile/certificates`). Uses identity-url/@EnableScheduling already added by the notification agent.
- Unit test EInvoicePackageAllocatorTest (pass).

gateway-service
- StoreStatusFilter (GlobalFilter, polls identity status, 5s cache): paused → 423 `STORE_PAUSED` except `/api/auth/**`, `/api/store-profile/**`, GET `/api/settings/**`; JWT iat < sessionsNotBefore → 401 `SESSION_REVOKED`. permitAll `/api/auth/store-status`.
- Routes: `/api/store-profile/**` → identity; `/api/store-profile/einvoice/**,/api/store-profile/certificates/**` → integration (order -1).

Built + restarted one at a time: identity, integration, gateway.

## Endpoints
- `GET /api/auth/2fa`, `POST /api/auth/2fa/setup|enable|disable|recovery-codes`; `POST /api/auth/login` (+`code`)
- `GET /api/auth/store-status` (public); `GET /api/auth/terms`, `POST /api/auth/terms/accept`
- `GET /api/store-profile`, `POST /verify`, `PUT /profile`, `PUT /phone`, `PUT /access-code`, `GET /transfer-candidates`, `POST /transfer|pause|reopen`, `GET /history` (all under /api/store-profile; view/profile/phone = owner or settings.manage; rename/transfer/pause/reopen = owner only)
- `GET /api/store-profile/einvoice`, `POST|PUT|DELETE /api/store-profile/einvoice/packages[/{id}]`
- `GET|POST /api/store-profile/certificates`, `PUT|DELETE /{id}`, `POST /parse` (multipart)

## Frontend
- `components/layout/account-menu-dropdown.tsx` (new) — app-header.tsx: only dropdown block swapped, NotificationBell kept.
- `features/auth/two-factor-dialog.tsx` (QR via existing `qrcode` lib, manual key, recovery codes copy/download, disable/regenerate).
- `app/login/page.tsx`: 2FA code field appears on TOTP_REQUIRED; "Duy trì đăng nhập" unchanged. BFF login route unchanged (passes `code` through).
- `app/(admin)/store-profile/{layout,page}.tsx`, `einvoice/page.tsx`, `certificates/page.tsx`, `terms/page.tsx`.
- `features/store-profile/`: store-profile-queries, store-profile-shell (left nav: only the 4 items), store-flow-parts (stepper, verify step, footer), store-info-general-tab, update-choice-dialog, profile-update-dialog, phone-change-dialog, rename-store-dialog (→ logout + /login?store=new), transfer-store-dialog, pause-store-dialog, einvoice-package-dialog, certificate-form-dialog, terms-of-use-content/-view, terms-queries, store-access-gate.
- `components/providers.tsx`: mounts StoreAccessGate (full-page paused notice; forced terms acceptance) — covers /sale too; skipped on /login, /welcome, /cham-cong.
- `lib/use-current-user.ts`: Me + `twoFactorEnabled?`, `storeOwner?`. `app/(admin)/invoices/page.tsx`: `?einvoice=PUBLISHED` deep link. `settings/store/page.tsx`: access code read-only + hint.
- `npx tsc --noEmit -p .` clean; eslint clean on all touched files.

## Tests
Scratchpad `e2e_store_profile.py`: **66/66 pass** — 2FA (setup, encrypted secret, wrong code, enable, hashed recovery codes, login TOTP_REQUIRED/ok/replay rejected, recovery single-use, lockout 429, disable needs password), profile update + validation + history (no CCCD leak), phone, settings access-code lock, transfer to temp ADMIN and back, owner lock protection, pause >60d rejected, pause + gateway 423 + allowed paths + reopen + once-only, package statuses/totals/remaining, .cer parse (keytool cert), private key rejected, cert CRUD keeps file, expiry notification created/resolved, terms version/accept, rename (pattern, same-name, new code lookup, old 404, refresh revoked, old JWT 401 at gateway, re-login). Finally-block restored settings keys (verified identical), access code, owner, deleted temp user/2FA/terms/packages/certs.

## Legal sources (verified 2026-10-29 by web research; aggregator sources — thuvienphapluat returned 403)
- Luật BVDLCN 91/2025/QH15, hiệu lực 01/01/2026 (72h breach notice Đ23): https://hethongphapluat.com/luat-bao-ve-du-lieu-ca-nhan-2025.html ; https://pbgdpl.cantho.gov.vn/luat-bao-ve-du-lieu-ca-nhan-nam-2025-bao-dam-quyen-rieng-tu-trong-ky-nguyen-so
- NĐ 356/2025/NĐ-CP (hiệu lực 01/01/2026, thay NĐ 13/2023): https://luatvietnam.vn/dan-su/nghi-dinh-356-2025-nd-cp-quy-dinh-chi-tiet-luat-bao-ve-du-lieu-ca-nhan-422896-d1.html
- Luật GDĐT 20/2023/QH15 (01/7/2024): https://pbgdpl.cantho.gov.vn/mot-so-noi-dung-moi-co-ban-cua-luat-giao-dich-dien-tu-nam-2023
- Luật An ninh mạng 116/2025/QH15 (01/7/2026, thay 24/2018/QH14): https://hethongphapluat.com/luat-an-ninh-mang-2025/dieu-44 ; .../dieu-45
- NĐ 123/2020 + NĐ 70/2025/NĐ-CP (01/6/2025): luatvietnam (bài 101431), meinvoice.vn/tin-tuc/31439
- Luật Kế toán 88/2015 (sửa đổi 56/2024/QH15) + NĐ 174/2016 (5/10 năm/vĩnh viễn): caselaw.vn; https://portal.mof.gov.vn/hoidapcstc/home/cthoidap/162984
- Luật Phòng bệnh 114/2025/QH15 (01/7/2026): https://luatvietnam.vn/y-te/luat-phong-benh-2025-so-114-2025-qh15-422004-d1.html ; NĐ 165/2026/NĐ-CP (thay NĐ 104/2016): https://hethongphapluat.com/nghi-dinh-165-2026-nd-cp-huong-dan-luat-phong-benh/chuong-10 ; TT 13/2026/TT-BYT (thay TT 34/2018): https://hethongphapluat.com/thong-tu-13-2026-tt-byt-quy-dinh-ve-hoat-dong-tiem-chung-do-bo-truong-bo-y-te-ban-hanh.html
- Luật KBCB 15/2023/QH15 Đ69: https://hethongphapluat.com/luat-kham-benh-chua-benh-2023/dieu-69

## Notes / concerns
- Terms text is original, marked "Bản nháp — cần chuyên gia pháp lý rà soát". Retention for vaccination records stated generically ("theo thời hạn pháp luật") — no fixed period found in TT 13/2026.
- Unverified: whether Luật ATTTM 86/2015 is also repealed; exact issue date of NĐ 165/2026; TT 33/2025/TT-BYT medical-record periods.
- Test run logged everyone out once (rename test revokes all refresh tokens) and left audit-log rows (feature "Hồ sơ cửa hàng"/"Tài khoản") — audit is intentionally not deleted.
- Admin has not accepted terms v1.0 → first UI visit shows the acceptance dialog (intended).
- Direct service-to-service calls bypass the gateway pause check (by design: gateway filter is the single enforcement point; only the browser path matters).
- Pause semantics: "Ngày mở lại" = first day open again (paused while today < reopenOn, max today+60).
- "Còn lại" on HĐĐT page = remaining of non-expired packages (KiotViet shows total−used); "Xem danh sách hoá đơn" filters `einvoiceStatus=PUBLISHED` (excludes "CQT chấp nhận" since the filter is single-select).
- 2FA setup in React StrictMode dev double-calls `/setup`; last write wins server-side, a rare race could show a stale QR in dev only.

## Unresolved questions
1. Should admins be able to reset another user's 2FA (lost phone + lost recovery codes)? Currently only DB intervention.
2. Should 2FA be mandatory for the owner / ADMIN role?
