# Refactor 261029 — identity + integration: service SQL → @Repository

Pure refactor. HTTP API, JSON, status/error codes, SQL text (verbatim), @Transactional / @Scheduled / synchronized, audit, notifications unchanged. Controllers untouched except reference renames.

## Renames (git mv, @Component → @Repository)
| Old | New | Why name |
|---|---|---|
| identity `settings/SettingsStore` | `SettingsRepository` | pure app_settings store; + `read(key, TypeReference)` overload |
| identity `notification/NotificationReader` | `NotificationQueryRepository` | writer SQL got `NotificationWriteRepository` |
| identity `hr/payroll/PayrollQuery` | `PayrollQueryRepository` | write side became `PayrollRepository` |
| integration `inputinvoice/InputInvoiceStore` | `InputInvoiceWriteRepository` | `InputInvoiceRepository` already exists; static `fromPortal` kept (TaxConnectionService uses it) |

## Extractions (class keeps logic/tx/schedule; SQL moved)
identity:
- `AttendanceQuery` (evaluation w/ settings) → SQL in `AttendanceRepository.cells()` (raw `CellRow`), evaluation stays.
- `AttendanceWriter` (slot pick / merge / validation) → `AttendanceRepository.scheduledShifts/find/insert/update`. `Existing` record moved to `AttendanceRepository.Existing` (PhoneClockService import updated).
- `PhoneClockService` → `ClockRepository.latestOpenShift/shiftName`.
- `HrJobs` (@Configuration @EnableScheduling, @Scheduled kept) → new `hr/HrJobsRepository`.
- `HrCashflowOutbox` (@Transactional MANDATORY, @Scheduled publish kept) → new `hr/HrCashflowOutboxRepository`.
- `EmployeeService` (216 → 164 lines) → new `EmployeeProfileRepository` (list/count, detail, insert/update, branches, pay items). Duplicate-key translation + validation stay in service.
- `PayrollService` → new `PayrollRepository`; JSON serialization of slip details stays in service.
- `PayrollPaymentService` → new `PayrollPaymentRepository`; payment code seq reuses identical `EmployeeRepository.nextPaymentCodeNumber()`.
- `ExpectedSalaryCalculator` → `ScheduleRepository.salariedWorkingEmployees/shiftsBetween`.
- `HrSettingsService` → uses `SettingsRepository.read(key, TypeReference)` (drops JdbcTemplate/ObjectMapper).
- `NotificationWriter` (dedupe/reopen rules, @Transactional, @Scheduled cleanup) → new `NotificationWriteRepository` (`cut()` moved there).

integration:
- `EInvoiceService` → `EInvoiceRepository` (+ getSettings, findRecords, getRecord, insertRecord, updateResult; `account()` reuses `findSettings()` — same SQL). Password still decrypted only in service via SecretCipher; nothing logged/returned.
- `IntegrationAlertJob` (@Configuration, synchronized, @Scheduled kept) → new `IntegrationAlertRepository` (raw rows; message text/`cut` built in job).

## Behaviour differences (minor, intentional)
- Streaming callbacks replaced by list-then-loop: `HrJobs.autoTimekeeping` (upsert after query completes, not inside RowCallbackHandler — no longer holds a 2nd connection during upserts), `PayrollService.recalculate` unpaid-slip deletion, `ExpectedSalaryCalculator` schedule scan. Same tx, same results.
- `HrSettingsService.readList`: a stored JSON literal `null` now yields empty list instead of null (previously would NPE later). Not reachable via API.
- Repos are now @Repository → Spring exception-translation proxy; JdbcTemplate already throws DataAccessException, so no change (DuplicateKeyException handling verified by e2e_hr).

## Verification
- `grep -rl JdbcTemplate --include=*.java <svc>/src/main | xargs grep -L @Repository` → empty for both services.
- `mvn -pl identity-service -am package`, `mvn -pl integration-service -am package` OK (unit tests pass).
- identity (8081 redeployed): e2e_login_flow 10/10, e2e_hr 84/0, e2e_store_profile 66/0, e2e_2fa_reset 23/0, e2e_notifications ALL PASSED, e2e_settings 31/31, e2e_phase2_settings 23/23, e2e_reports 39/39, smoke_identity_layering none failed.
- integration (8088 redeployed): e2e_integration 16/16, e2e_store_profile 66/0, e2e_notifications ALL PASSED, e2e_sales 22/22, e2e_invoice_filters 15/15 (0 leftover rows), e2e_sectors_wallets 12/12, smoke_integration_layering 24/24.

## Commits
- `refactor(identity): move service SQL into repositories`
- `refactor(integration): move service SQL into repositories`
(some new files were captured earlier by the auto-commit hook as `auto: update ...`). Not pushed.

## Open questions
- None blocking.
