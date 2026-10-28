/** Kiểu dữ liệu module Nhân viên — khớp DTO identity-service (package com.vaxclinic.identity.hr). Tiền là số VNĐ. */
import type { HrT } from "@/messages/hr";

export type SalaryType = "SHIFT" | "HOUR" | "STANDARD_DAY" | "FIXED";

/** [loại, khóa nhãn, khóa đơn vị] — dịch lúc hiển thị bằng t (namespace hr). */
export const SALARY_TYPES = [
  ["SHIFT", "salaryType.shift", "salaryType.perShift"],
  ["HOUR", "salaryType.hour", "salaryType.perHour"],
  ["STANDARD_DAY", "salaryType.standardDay", "salaryType.perPeriod"],
  ["FIXED", "salaryType.fixed", "salaryType.perPeriod"],
] as const satisfies readonly (readonly [SalaryType, string, string])[];

export const salaryTypeLabel = (t: HrT, type: string | null) => {
  const s = SALARY_TYPES.find((x) => x[0] === type);
  return s ? t(s[1]) : t("salaryType.notSet");
};

/** Phụ cấp: DAY (theo ngày làm) / MONTH (cố định tháng). Giảm trừ: LATE / EARLY (mỗi lần) / MONTH. */
export type PayItem = { name: string; kind: "DAY" | "MONTH" | "LATE" | "EARLY"; amount: number };

export type CatalogItem = { id: string; name: string; employeeCount: number };

export type EmployeeRow = {
  id: string; code: string; timekeepingCode: string | null; name: string; phone: string | null; idNumber: string | null;
  debt: number; note: string | null; status: "WORKING" | "QUIT"; salaryType: SalaryType | null; salaryAmount: number;
  departmentId: string | null; departmentName: string | null; jobTitleId: string | null; jobTitleName: string | null;
  mainBranchId: string | null; userId: string | null;
};

export type Employee = {
  id: string; code: string; timekeepingCode: string | null; name: string; phone: string | null; idNumber: string | null;
  birthday: string | null; gender: "MALE" | "FEMALE" | null; startDate: string | null; endDate: string | null; mainBranchId: string | null;
  branches: { id: string; name: string }[]; departmentId: string | null; departmentName: string | null;
  jobTitleId: string | null; jobTitleName: string | null; userId: string | null; username: string | null;
  status: "WORKING" | "QUIT"; note: string | null; salaryType: SalaryType | null; salaryAmount: number; overtimePercent: number;
  commissionTableId: string | null; commissionTableName: string | null; allowances: PayItem[]; deductions: PayItem[]; debt: number;
};

export type EmployeeRequest = {
  code?: string; timekeepingCode?: string; name: string; phone?: string; idNumber?: string; birthday?: string | null;
  gender?: "MALE" | "FEMALE" | null; startDate?: string | null; endDate?: string | null; mainBranchId?: string | null; branchIds?: string[];
  departmentId?: string | null; jobTitleId?: string | null; userId?: string | null; status?: "WORKING" | "QUIT"; note?: string;
  salaryType?: SalaryType | null; salaryAmount?: number; overtimePercent?: number; commissionTableId?: string | null;
  allowances?: PayItem[]; deductions?: PayItem[];
};

export type AdvanceItem = { id: string; kind: "ADVANCE" | "DEDUCT"; amount: number; occurredAt: string; note: string | null; cancelled: boolean };

/** startTime/endTime "HH:mm:ss"; minutes = độ dài ca (ca qua đêm tính sang hôm sau). */
export type Shift = { id: string; name: string; startTime: string; endTime: string; active: boolean; minutes: number };

export type ScheduleItem = { id: string; employeeId: string; shiftId: string; date: string };
/** expected: employeeId → Lương dự kiến (không có key = chưa thiết lập lương). */
export type ScheduleWeek = { items: ScheduleItem[]; expected: Record<string, number> };

export type AttendanceStatus = "ON_TIME" | "LATE_EARLY" | "MISSING" | "NOT_CHECKED" | "ABSENT";

/** Chú thích màu Bảng chấm công (như KiotViet). */
export const ATTENDANCE_STATUS = {
  ON_TIME: { label: "attendanceStatus.onTime", color: "#1f6fe5" },
  LATE_EARLY: { label: "attendanceStatus.lateEarly", color: "#9b51e0" },
  MISSING: { label: "attendanceStatus.missing", color: "#e5383b" },
  NOT_CHECKED: { label: "attendanceStatus.notChecked", color: "#f2994a" },
  ABSENT: { label: "attendanceStatus.absent", color: "#9aa1ab" },
} as const satisfies Record<AttendanceStatus, { label: string; color: string }>;

export type AttendanceCell = {
  attendanceId: string | null; scheduleId: string | null; employeeId: string; employeeCode: string; employeeName: string;
  shiftId: string; shiftName: string; shiftStart: string; shiftEnd: string; date: string;
  checkIn: string | null; checkOut: string | null; absence: "PAID" | "UNPAID" | null; approved: boolean;
  source: "MANUAL" | "PHONE" | "MACHINE" | "AUTO" | null; note: string | null; status: AttendanceStatus;
  workedMinutes: number; lateMinutes: number; earlyMinutes: number; otMinutes: number;
};

export type MachineImportResult = { rows: number; punches: number; records: number; unknownCodes: string[]; unmatched: number; errors: string[] };

export type PayrollStatus = "DRAFT" | "TEMP" | "LOCKED" | "CANCELLED";
export const PAYROLL_STATUS = [
  ["DRAFT", "payrollStatus.draft"], ["TEMP", "payrollStatus.temp"], ["LOCKED", "payrollStatus.locked"], ["CANCELLED", "payrollStatus.cancelled"],
] as const satisfies readonly (readonly [PayrollStatus, string])[];

export type Payroll = {
  id: string; code: string; name: string; payCycle: "MONTHLY"; periodStart: string; periodEnd: string; branchId: string | null;
  status: PayrollStatus; total: number; paid: number; remaining: number; createdByName: string | null; createdAt: string;
  computedAt: string | null; lockedAt: string | null;
};

export type PayrollPage = { items: Payroll[]; total: number; page: number; size: number; sumTotal: number; sumPaid: number; sumRemaining: number };

export type PayslipDetails = {
  standardDays: number; workedDays: number; lateCount: number; earlyCount: number; overtimeMinutes: number; shifts: number;
  allowances: { name: string; kind: string; amount: number }[]; deductions: { name: string; kind: string; amount: number }[];
  commissions: { productCode: string; productName: string; quantity: number; revenue: number; commission: number }[];
};

export type Payslip = {
  id: string; employeeId: string; employeeCode: string; employeeName: string; salaryType: SalaryType | null; workUnits: number;
  baseAmount: number; overtimeAmount: number; holidayAmount: number; allowance: number; commission: number; bonus: number;
  deduction: number; insurance: number; tax: number; total: number; paid: number; advanceBalance: number; details: PayslipDetails | null;
};

export type PayrollPayment = {
  id: string; code: string; payslipId: string; employeeName: string; cashAmount: number; advanceAmount: number;
  method: "CASH" | "BANK"; paidAt: string; createdByName: string | null; cancelled: boolean;
};

export type PayrollDetail = { payroll: Payroll; payslips: Payslip[]; payments: PayrollPayment[] };

export type CommissionTable = { id: string; name: string; active: boolean; ruleCount: number; employeeCount: number };
export type CommissionRule = { tableId: string; productId: string; rateType: "PERCENT" | "AMOUNT"; value: number };

export type TimekeepingSettings = {
  standardHours: number; convertEnabled: boolean; halfFrom: number; fullFrom: number; lateEarlyForHalf: boolean;
  lateEnabled: boolean; lateAfter: number; earlyEnabled: boolean; earlyBefore: number;
  otBeforeEnabled: boolean; otBefore: number; otAfterEnabled: boolean; otAfter: number; otActualAll: boolean;
  singleInOutMultiShift: boolean; autoTimekeeping: boolean; allowUnscheduled: boolean;
};

export type PayrollSettings = {
  startDay: number; hourMode: "ACTUAL" | "SHIFT"; autoCreate: boolean; autoUpdate: boolean; allowances: string[]; deductions: string[];
  taxEnabled: boolean; taxRate: number; taxDeduction: number; insuranceEnabled: boolean; insuranceRate: number; commissionBase: "NET" | "PAID";
};

/** days: 1 = Thứ hai … 7 = Chủ nhật. */
export type BranchWorkdays = { branchId: string; days: number[] };
/** multiplier: hệ số lương %, VD 200 = gấp đôi. */
export type Holiday = { id?: string; name: string; from: string; to: string; multiplier: number };
export type MobileSettings = { enabled: boolean; requireQr: boolean };
export type SalaryTemplate = {
  id?: string; name: string; salaryType: SalaryType | null; salaryAmount: number | null; overtimePercent: number | null;
  commissionTableId: string | null; allowances: PayItem[]; deductions: PayItem[];
};

export type HrSettings = {
  timekeeping: TimekeepingSettings; payroll: PayrollSettings; workdays: BranchWorkdays[]; holidays: Holiday[];
  mobile: MobileSettings; templates: SalaryTemplate[];
};

export type HrOverview = { employees: number; shifts: number; schedules: number; timekeeping: number; salaries: number; payrolls: number };

/** Khóa nhãn thứ (index 0 = Thứ hai … 6 = Chủ nhật), dịch bằng t (namespace hr). */
export const WEEKDAY_SHORT = ["weekday.short.mon", "weekday.short.tue", "weekday.short.wed", "weekday.short.thu",
  "weekday.short.fri", "weekday.short.sat", "weekday.short.sun"] as const;
export const WEEKDAY_LONG = ["weekday.long.mon", "weekday.long.tue", "weekday.long.wed", "weekday.long.thu",
  "weekday.long.fri", "weekday.long.sat", "weekday.long.sun"] as const;
