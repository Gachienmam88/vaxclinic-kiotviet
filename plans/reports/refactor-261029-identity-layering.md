# Refactor identity-service: Controller → Service → Repository (2026-10-29)

Pure refactor. Paths, JSON shape, status codes, error codes/messages unchanged. `grep -rl JdbcTemplate --include=*Controller.java backend/identity-service/src/main` → empty.

## What moved where (package `com.vaxclinic.identity`)

| Controller | Service (logic, @Transactional, audit) | Repository (SQL) | DTOs |
|---|---|---|---|
| audit/AuditLogController | AuditLogService (paging cap 200, CSV build/escape) | AuditLogRepository (insert, filter, count/find/forEach, features) | AuditLogRepository.AuditLogItem / Filter |
| (nested JdbcAuditLogger) | → top-level audit/JdbcAuditLogger (uses repo) | | |
| branch/BranchController | BranchService | BranchRepository (JPA, unchanged) + BranchUserCountRepository | BranchModels |
| role/RoleController | RoleService | RoleRepository (JPA) + RoleUserRepository | RoleModels |
| settings/PrintTemplateController | PrintTemplateService | SettingsStore (+ new `delete(key)`) | TemplateRequest stays nested (stored JSON type) |
| notification/AnnouncementController | AnnouncementService (link check, audit) | AnnouncementRepository | AnnouncementModels |
| hr/schedule/ShiftController | ShiftService | ShiftRepository (also `findActiveIdByName`) | `Shift` now top-level record; ShiftRequest nested |
| hr/schedule/ScheduleController | ScheduleService | ScheduleRepository | ScheduleModels |
| hr/settings/HrSettingsController | HrSettingsManageService (validation/clean + audit) | HrSetupProgressRepository; writes via existing HrSettingsService | `AllHrSettings` moved into HrSettings; `Items<T>` stays nested |
| hr/employee/HrCatalogController | HrCatalogService | HrCatalogRepository (Kind record) | records nested |
| hr/employee/EmployeeController | EmployeeService (+create/update/delete with audit), EmployeeAdvanceService (new) | EmployeeRepository (new: usage, delete, findIdByCode, findName, timekeeping codes, advances, payment seq) | EmployeeDtos (unchanged) |
| hr/attendance/AttendanceController | AttendanceService | AttendanceRepository (delete/approve) + existing AttendanceWriter/Query | records nested |
| hr/attendance/MachineImportController | MachineImportService (ImportResult nested) + MachineLogFormat (column/time parsing helpers) | EmployeeRepository.workingTimekeepingCodes | |
| hr/clock/ClockController | ClockService | ClockRepository | ClockModels |
| hr/commission/CommissionController | CommissionService | CommissionRepository | CommissionModels |

Collateral: `ShiftController.load(jdbc)` (static) removed → `ShiftRepository.findAll()` injected into AttendanceWriter, HrJobs, ExpectedSalaryCalculator.

Behaviour nuances (happy path identical):
- Employee create/update: audit row now written inside the same transaction as the save (before: after commit). Only differs if the audit insert itself fails.
- `HrActor.of(jwt)` / user id now parsed before the operation instead of after; JWT subject is always a UUID.
- Transaction boundaries otherwise identical (only methods that were @Transactional in the controller are @Transactional in the service).

## Verification
- `mvn -q -pl identity-service -am package` OK (unit tests pass). Redeployed :8081, health 200.
- E2E (all PASS): login_flow 10/10, hr 84/0, store_profile 66/0, 2fa_reset 23/0, notifications ALL PASSED, settings 31/31, phase2_settings 23/23, reports 39/39.
- Extra read/validation-only smoke (scratchpad `smoke_identity_layering.py`, no data written) 21/21: audit search/features/export, branch 409/404, role ADMIN delete 400 / invalid perm 400, print template invalid type, announcement invalid link / 404 / size cap, HR overview keys, schedule range 400, shift start=end 400, machine import empty file 400.

## Other identity controllers with business logic (no JdbcTemplate; not changed)
- settings/SettingsController — validation (logo, access code lock, customer fields, debt limit, lock dates) + audit logging.
- settings/TaxSettingsController — heavy validation of sectors / tax profiles / locations + audit.
- settings/StoreAccessController — access-code matching logic.
- notification/NotificationController — some request handling logic (types/dedupe keys) around NotificationWriter.
- hr/payroll/PayrollController — audit logging in controller.

## Non-controller classes still holding SQL directly (not @Repository)
EmployeeService, HrSettingsService, AttendanceQuery, AttendanceWriter, PhoneClockService, PayrollQuery/PayrollService/PayrollPaymentService, HrJobs, ExpectedSalaryCalculator, HrCashflowOutbox, NotificationReader/Writer, SettingsStore.

## Unresolved questions
- Should the remaining service-level SQL above (esp. EmployeeService, Payroll*) be split into repositories in a follow-up?
- EmployeeService is now ~216 lines (over 200 guideline); split candidate along with that follow-up.
