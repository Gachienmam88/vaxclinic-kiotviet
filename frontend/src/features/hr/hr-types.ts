/** Kiểu dữ liệu module Nhân viên — khớp DTO identity-service (package com.vaxclinic.identity.hr). Tiền là số VNĐ. */

export type SalaryType = "SHIFT" | "HOUR" | "STANDARD_DAY" | "FIXED";

export const SALARY_TYPES: [SalaryType, string, string][] = [
  ["SHIFT", "Theo ca", "/ca"],
  ["HOUR", "Theo giờ", "/giờ"],
  ["STANDARD_DAY", "Theo ngày công chuẩn", "/kỳ lương"],
  ["FIXED", "Cố định hàng tháng", "/kỳ lương"],
];

export const salaryTypeLabel = (t: string | null) => SALARY_TYPES.find((s) => s[0] === t)?.[1] ?? "Chưa thiết lập";

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
  birthday: string | null; gender: "MALE" | "FEMALE" | null; startDate: string | null; mainBranchId: string | null;
  branches: { id: string; name: string }[]; departmentId: string | null; departmentName: string | null;
  jobTitleId: string | null; jobTitleName: string | null; userId: string | null; username: string | null;
  status: "WORKING" | "QUIT"; note: string | null; salaryType: SalaryType | null; salaryAmount: number; overtimePercent: number;
  commissionTableId: string | null; commissionTableName: string | null; allowances: PayItem[]; deductions: PayItem[]; debt: number;
};

export type EmployeeRequest = {
  code?: string; timekeepingCode?: string; name: string; phone?: string; idNumber?: string; birthday?: string | null;
  gender?: "MALE" | "FEMALE" | null; startDate?: string | null; mainBranchId?: string | null; branchIds?: string[];
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
export const ATTENDANCE_STATUS: Record<AttendanceStatus, { label: string; color: string }> = {
  ON_TIME: { label: "Đúng giờ", color: "#1f6fe5" },
  LATE_EARLY: { label: "Đi muộn / Về sớm", color: "#9b51e0" },
  MISSING: { label: "Chấm công thiếu", color: "#e5383b" },
  NOT_CHECKED: { label: "Chưa chấm công", color: "#f2994a" },
  ABSENT: { label: "Nghỉ làm", color: "#9aa1ab" },
};

export type AttendanceCell = {
  attendanceId: string | null; scheduleId: string | null; employeeId: string; employeeCode: string; employeeName: string;
  shiftId: string; shiftName: string; shiftStart: string; shiftEnd: string; date: string;
  checkIn: string | null; checkOut: string | null; absence: "PAID" | "UNPAID" | null; approved: boolean;
  source: "MANUAL" | "PHONE" | "MACHINE" | "AUTO" | null; note: string | null; status: AttendanceStatus;
  workedMinutes: number; lateMinutes: number; earlyMinutes: number; otMinutes: number;
};

export type MachineImportResult = { rows: number; punches: number; records: number; unknownCodes: string[]; unmatched: number; errors: string[] };

export type PayrollStatus = "DRAFT" | "TEMP" | "LOCKED" | "CANCELLED";
export const PAYROLL_STATUS: [PayrollStatus, string][] = [["DRAFT", "Đang tạo"], ["TEMP", "Tạm tính"], ["LOCKED", "Đã chốt lương"], ["CANCELLED", "Đã hủy"]];

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

export const WEEKDAY_SHORT = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
export const WEEKDAY_LONG = ["Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy", "Chủ nhật"];
