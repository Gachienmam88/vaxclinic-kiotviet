# Refactor 261029 — integration-service layering (Controller → Service → Repository)

Pure refactor. Paths, JSON, status codes, error codes/messages, transaction boundaries unchanged. No audit logging exists in integration-service (nothing to move).

## Changes (backend/integration-service/src/main/java/com/vaxclinic/integration/)

| Controller | Now delegates to | New repository | Notes |
|---|---|---|---|
| einvoice/EInvoiceController | new `EInvoiceSettingsService` (settings/save/test/byInvoices/statuses/published) + existing `EInvoiceService.publish` | `EInvoiceRepository` (einvoice_settings upsert/find, einvoice_records lookups) | `SettingsRequest` stays nested in controller (DigitalCertificate style). Password never returned. |
| inputinvoice/InputInvoiceController | new `InputInvoiceService` | `InputInvoiceRepository` (search, findById, buyer tax codes, linkReceipt) | Records `Item`/`Page`/`ReceiptLink` moved → `InputInvoiceModels` (same JSON). |
| inputinvoice/TaxConnectionController | new `TaxConnectionService` (create/update/delete/captcha/sync, DuplicateKey→409) | `TaxConnectionRepository` | `ConnectionResponse` moved → `TaxConnectionRepository.ConnectionResponse`; request records stay in controller. |
| payment/SePayController | new `SePayService` | `SePayRepository` | `@Transactional` moved from controller `webhook` → `SePayService.webhook` (only tx method). Auth check (constant-time compare, Bearer/Apikey prefix strip), idempotency (`on conflict (sepay_id) do nothing` → credit only if inserted=1), code matching copied verbatim. Service returns `WebhookResult` enum; controller maps to 503/401/400/200 + `{"success": bool}` exactly as before. JWT subject passed as String, parsed in service at same point as before. |

Unchanged: storeprofile/* (already layered), notification/IntegrationAlertJobController (already delegates only), `/internal/**` endpoints (same paths + `hasAuthority('internal')`).

`grep -rl JdbcTemplate --include=*Controller.java backend/integration-service/src/main` → empty.

## Not reworked this pass (SQL inside non-repository classes)
- `einvoice/EInvoiceService` — JdbcTemplate on einvoice_settings / einvoice_records (publish flow).
- `inputinvoice/InputInvoiceStore` (@Component) — upsert into input_invoices.
- `notification/IntegrationAlertJob` (@Configuration) — reads einvoice_records, sepay_settings, bank_transactions/payment_requests.

## Verification
- Compile + `mvn -pl integration-service -am package` OK (unit tests pass).
- Redeployed :8088 only; health 200.
- e2e: integration 16/16, store_profile 66/66, notifications ALL PASSED (sepay check skipped by script — existing config untouched), sales 22/22, invoice_filters 15/15, sectors_wallets 12/12, phase2_settings 23/23.
- New smoke (read/validation only, no data written, no external calls): `scratchpad/smoke_integration_layering.py` 24/24 — einvoice settings has no password key, invalid body 400, internal endpoints 401/403, input invoice 404s + page clamp, tax-connection 400/404/RANGE_INVALID/204, SePay settings has no key, webhook rejected (503 when disabled) with `{"success":false}`, payment-request 404/400/SEPAY_DISABLED, transactions limit, alert job run.

## Behaviour notes
- SePay warn log "SePay webhook rejected: wrong API key" now logged under category `...payment.SePayService` (was `SePayController`). Message identical; no key logged.

## Unresolved questions
- Should the three classes above get repositories in a follow-up pass?
- `/internal/einvoices/{id}/published` only verified for auth (403 with user token); happy path is exercised indirectly by sales-service edit/cancel flows, not by a direct service-token call.
