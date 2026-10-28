# HR (Nhân viên) module — implementer report (2026-10-28)

Status: DONE_WITH_CONCERNS (only open item: commission calc is not yet E2E-verified, because sales-service has to be rebuilt first)

## Summary
The HR module is built end to end inside identity-service (no new JVM): employees, shifts, schedules, attendance, phone clock-in via a branch QR code, attendance machine file import, payroll and commission. Flyway migration V4 has been applied and identity-service has been restarted with the new code. The frontend has all the requested routes. The HR files pass `tsc` and `eslint` with no errors; the other tsc errors are in other agents' files (features/reports/*). Backend E2E: 80/80 checks pass and test data is cleaned up.

## Backend (identity-service, package `com.vaxclinic.identity.hr`)
- `V4__hr_schema.sql`: hr_departments, hr_job_titles, hr_employees (+branches, pay_items), hr_shifts, hr_schedules, hr_attendance, hr_advances, hr_payrolls, hr_payslips, hr_payroll_payments, hr_commission_tables/rules, outbox_cashflows, plus code sequences (NV/BL/PCPL/PCTU).
- Permission `hr.manage` added to Permissions.ALL; ADMIN picks it up at startup. Label added in `role-form-dialog.tsx`.
- Settings are stored in app_settings under the keys `hr.timekeeping`, `hr.payroll`, `hr.workdays`, `hr.holidays`, `hr.mobile`, `hr.templates`. Unsaved keys fall back to KiotViet defaults.
- Files:
  - `HrActor`, `HrCashflowOutbox`, `HrJobs`
  - `settings/*`, `employee/*`
  - `schedule/{ShiftController,ScheduleController,ExpectedSalaryCalculator}`
  - `attendance/{AttendanceRules,AttendanceQuery,AttendanceWriter,AttendanceController,MachineImportController,SpreadsheetReader}`
  - `clock/{ClockTokenService,PhoneClockService,ClockController}`
  - `payroll/{PayRates,PayrollCalculator,PayrollService,PayrollPaymentService,PayrollQuery,PayrollController}`
  - `commission/{CommissionController,SellerRevenueClient}`
- `application.yml` adds `app.sales-url`, `app.hr.clock-secret` (`${ENCRYPTION_KEY:${JWT_SECRET}}`) and 10MB multipart limits.
- Every write is audit-logged under feature "Nhân viên" / "Chấm công" / "Bảng lương". Everything is protected by `hr.manage` except `/api/hr/clock` and `/api/hr/clock/me`, which only need a logged-in user.
- Cashbook: salary payments write "Chi trả lương nhân viên" (sourceType PAYROLL, code PCPL…, partner EMPLOYEE) and advances write "Chi tạm ứng lương nhân viên" (HR_ADVANCE, PCTU…). Both go through the outbox to the existing sales `/internal/cashflows`, using the ServiceTokenProvider pattern. Cancelling a payment sends CANCEL.

### Calculation rules
- **Attendance status.**
  - Status values: ON_TIME / LATE_EARLY / MISSING / NOT_CHECKED / ABSENT (PAID or UNPAID leave).
  - Late = check-in later than start + grace minutes; early = check-out earlier than end − grace minutes.
  - Overtime before/after the shift counts above a threshold: either the minutes beyond it, or the whole extra time when "toàn bộ thời gian thực tế" is on.
  - Worked time: ACTUAL = out − in − OT; SHIFT = only the overlap with the shift.
  - Overnight shifts are supported.
- **Payroll.** Only approved attendance counts. Base pay by salary type:
  - SHIFT: amount per shift.
  - HOUR: amount per hour.
  - STANDARD_DAY: amount / standard days × day units. Standard days = branch working weekdays in the period. Day units come from minutes ÷ standard hours, or from the half/full-day conversion.
  - FIXED: the full amount.
- **Adjustments.**
  - OT = hourly rate × OT% × holiday %.
  - Holiday premium = pay × (multiplier − 100%).
  - Allowances: DAY × worked days, or MONTH.
  - Deductions: LATE/EARLY × count, or MONTH.
  - Commission from the employee's table, plus a manual bonus.
- **Insurance and tax (only when enabled).** BHXH = rate% × contract amount. TNCN = rate% × (gross − BHXH − personal deduction).
- **Payroll statuses.** Created as DRAFT, then becomes TEMP; recalculation is only allowed in TEMP. LOCKED (Đã chốt) is required before payments. Cancelling is only allowed when there are no active payments.
- **Payments.** Partial or full, and each payslip can take cash and/or an advance deduction (capped at the advance balance).
- **Background jobs (HrJobs).** Auto-create the current-period payroll (setting autoCreate). Auto-recalculate TEMP payrolls every 6h (autoUpdate). Auto-timekeeping (when enabled) fills ended scheduled shifts as on-time with source AUTO, pending approval.

### Phone clock-in design ("Chấm công trên điện thoại", free replacement for the Zalo mini app)
- In Thiết lập → Chấm công điện thoại → "Hiện mã QR chi nhánh", the counter screen polls `GET /api/hr/clock/qr?branchId` (hr.manage) every 60s. It renders a QR code of `{origin}/cham-cong?t={branchId}.{slot}.{sig}`, where slot = epochSec/60.
- sig = base64url(HMAC-SHA256(K, "branchId:slot"))[0..16], with K = HMAC-SHA256(ENCRYPTION_KEY, or JWT secret if unset, "vaxclinic-hr-clock-qr-v1"). The key is never stored or sent to the browser.
- The server accepts only the current or previous slot, so a code is at most about 2 minutes old. Future slots and forged signatures are rejected. The employee must belong to the token's branch.
- The employee is resolved from `hr_employees.user_id` = the JWT subject.
- The `hr.mobile.requireQr` setting defaults to true. When it is off, check-in is allowed without a QR code; a token that is supplied is still verified.
- Vào ca picks the nearest scheduled shift (or any active shift if "Chấm công không cần xếp lịch" is on) within a ±4h window. Ra ca closes the open shift. "1 lượt Vào-Ra nhiều ca liên tục" splits the punch across back-to-back shifts.
- `/cham-cong` is a mobile page outside the admin layout. It also has an in-page QR scanner (BarcodeDetector). The middleware remembers `/cham-cong?t=…` in a 10-minute cookie, so after login the user comes back to it. The page could later be wrapped as a Zalo Mini App.
- Known limit: someone at the counter could photograph the code and send it to a remote colleague, who could then use it within ~2 minutes. Mitigations would be GPS or a one-time nonce; not implemented.

### Machine import
- `POST /api/hr/attendance/import` (multipart) accepts CSV/TXT (`,` `;` or tab) or XLSX. XLSX is parsed in-house with zip + StAX, with XXE and zip-size guards; legacy .xls is rejected with a hint.
- Columns are detected from the header (Mã chấm công / AC-No. / User ID + Thời gian, or Ngày + Giờ). Without a header, column 0 is the code and column 1 the time.
- Accepted values: many date formats, SA/CH/AM/PM, and Excel serial dates. Leading zeros in codes are ignored.
- Each punch is matched to a shift; check-in = earliest punch, check-out = latest. Approved or leave records are never overwritten.
- The response returns rows, punches, records, unknownCodes, unmatched and errors. The page shows instructions in the style of screenshot 123.

## sales-service — LEAD ACTION NEEDED
- New file only: `backend/sales-service/src/main/java/com/vaxclinic/sales/accounting/SellerRevenueInternalController.java`, serving `GET /internal/seller-revenue?from&to` (internal JWT only).
- It returns sellerId × productId with code, name, quantity, netRevenue and paidRevenue. netRevenue = completed invoices after invoice-discount allocation, minus returns in the period; paidRevenue = netRevenue × the invoice's paid/total ratio. The SQL was checked by running it directly against sales_db.
- `invoices.seller_id` is a user id, so employees link to sales through their user account.
- **Please rebuild and restart sales-service.** Until then, creating or recalculating a payroll fails with SALES_UNAVAILABLE whenever an employee has both a commission table and a linked user. Employees without a commission table are unaffected.
- After the rebuild, rerun the E2E script; its commission step runs automatically once the jar contains the class.

## Gateway
- `backend/gateway-service/src/main/resources/application.yml`: added `/api/hr/**` to the identity route predicates. The gateway was not restarted, so **it needs a restart** before the UI can reach /api/hr.

## Frontend routes
`/employees`, `/employees/schedules`, `/employees/timesheets`, `/employees/payrolls`, `/employees/payrolls/[id]`, `/employees/commissions`, `/employees/settings/{start,timekeeping,payroll,workdays,mobile,machine}`, `/cham-cong`.
- Files are in `frontend/src/features/hr/*` and `frontend/src/app/(admin)/employees/**`, plus `frontend/src/app/cham-cong/page.tsx`.
- `middleware.ts` gained return-after-login for /cham-cong. `role-form-dialog.tsx` gained the hr.manage label.

## Menu entries for app-header-nav-menu.tsx (lead to wire; suggested perm `hr.manage`)
Nhân viên →
- Danh sách nhân viên `/employees`
- Lịch làm việc `/employees/schedules`
- Bảng chấm công `/employees/timesheets`
- Bảng lương `/employees/payrolls`
- Bảng hoa hồng `/employees/commissions`
- Thiết lập nhân viên `/employees/settings/start`

The current "Nhân viên" menu points to /settings/users and /settings/audit-logs. Those can stay as an extra group: Người dùng `/settings/users`, Lịch sử thao tác `/settings/audit-logs`.

## Tests
- Script: `C:\Users\chipc\AppData\Local\Temp\claude\C--Users-chipc-Desktop-kiot-viet-clone\a238b785-acf8-44ef-bf0d-f8ed0a62f4a4\scratchpad\e2e_hr.py`, run against :8081 with the admin JWT.
- Result: **PASSED 80, FAILED 0**.
- Coverage:
  - Settings validation; employee and catalog CRUD with duplicate-code/name errors and filters.
  - Shifts and weekly-repeat schedules; expected salary.
  - Attendance status for on-time, late, early, OT, missing, absent and the grace/threshold rules.
  - CSV and XLSX machine import.
  - Payroll for all 4 salary types with exact numbers; holiday 200%; allowance and late deduction; BHXH and TNCN; bonus.
  - Lock, payment validation, partial payments with an advance deduction, cancelling a payment.
  - Cash vouchers verified in sales_db: PAID and then CANCELLED.
  - QR: matches the documented HMAC; previous-minute token accepted; expired, future, forged and wrong-branch tokens rejected; no token, double IN, OUT, QR-less mode, non-employee user.
- Commission step was SKIPPED because sales-service had not been rebuilt.
- Cleanup removes employees, shifts, payrolls, users, test cash vouchers in sales_db, and restores the original hr.* settings. Verified: 0 rows left.
- Frontend: `tsc` shows no errors in HR files; `eslint` is clean on all HR files.

## Open questions
1. Payments require Đã chốt lương. Should Tạm tính payrolls also be payable?
2. FIXED salary always pays the full amount, with no proration for joining or leaving mid-period. Is that acceptable?
3. Is the QR replay window of ~2 minutes acceptable, or should GPS or a one-time nonce be added later?
4. "Duyệt yêu cầu" just links to the timesheet (Duyệt chấm công); there is no employee request workflow.
