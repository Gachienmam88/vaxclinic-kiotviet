"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, errorMessage, type PageResponse } from "@/lib/api-client";
import type {
  AttendanceCell, CatalogItem, CommissionRule, CommissionTable, Employee, EmployeeRow, HrOverview, HrSettings,
  PayrollDetail, PayrollPage, ScheduleWeek, Shift,
} from "./hr-types";

/** Hook TanStack Query cho module Nhân viên (/api/hr/** qua BFF). Mọi khóa bắt đầu bằng "hr". */

export const useEmployees = (params: URLSearchParams) =>
  useQuery({ queryKey: ["hr", "employees", params.toString()], queryFn: () => api<PageResponse<EmployeeRow>>(`/hr/employees?${params}`) });

/** Toàn bộ nhân viên đang làm (lưới lịch, chấm công, ô chọn). */
export const useAllEmployees = (status = "WORKING") =>
  useQuery({
    queryKey: ["hr", "employees", "all", status],
    queryFn: () => api<PageResponse<EmployeeRow>>(`/hr/employees?size=500${status ? `&status=${status}` : ""}`).then((p) => p.items),
  });

export const useEmployee = (id: string | null) =>
  useQuery({ queryKey: ["hr", "employee", id], queryFn: () => api<Employee>(`/hr/employees/${id}`), enabled: !!id });

export const useCatalog = (kind: "departments" | "job-titles") =>
  useQuery({ queryKey: ["hr", kind], queryFn: () => api<CatalogItem[]>(`/hr/${kind}`) });

export const useShifts = () => useQuery({ queryKey: ["hr", "shifts"], queryFn: () => api<Shift[]>("/hr/shifts") });

export const useSchedules = (from: string, to: string) =>
  useQuery({ queryKey: ["hr", "schedules", from, to], queryFn: () => api<ScheduleWeek>(`/hr/schedules?from=${from}&to=${to}`) });

export const useAttendance = (from: string, to: string) =>
  useQuery({ queryKey: ["hr", "attendance", from, to], queryFn: () => api<AttendanceCell[]>(`/hr/attendance?from=${from}&to=${to}`) });

export const useHrSettings = () => useQuery({ queryKey: ["hr", "settings"], queryFn: () => api<HrSettings>("/hr/settings") });

export const useHrOverview = () => useQuery({ queryKey: ["hr", "overview"], queryFn: () => api<HrOverview>("/hr/settings/overview") });

export const usePayrolls = (params: URLSearchParams) =>
  useQuery({ queryKey: ["hr", "payrolls", params.toString()], queryFn: () => api<PayrollPage>(`/hr/payrolls?${params}`) });

export const usePayroll = (id: string) =>
  useQuery({ queryKey: ["hr", "payroll", id], queryFn: () => api<PayrollDetail>(`/hr/payrolls/${id}`) });

export const useCommissionTables = () =>
  useQuery({ queryKey: ["hr", "commission-tables"], queryFn: () => api<CommissionTable[]>("/hr/commission-tables") });

export const useCommissionRules = () =>
  useQuery({ queryKey: ["hr", "commission-rules"], queryFn: () => api<CommissionRule[]>("/hr/commission-tables/rules") });

/** Mutation chung: gọi API, báo toast, làm mới mọi query "hr". */
export function useHrMutation<TVars, TResult = unknown>(fn: (v: TVars) => Promise<TResult>, success?: string,
  onDone?: (r: TResult) => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (r) => {
      if (success) toast.success(success);
      qc.invalidateQueries({ queryKey: ["hr"] });
      onDone?.(r);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}

/** Lưu 1 khóa thiết lập HR (PUT /hr/settings/{key}). Danh sách gửi dạng { items }. */
export function useSaveHrSetting(key: "timekeeping" | "payroll" | "workdays" | "holidays" | "mobile" | "templates") {
  return useHrMutation((body: unknown) => api<HrSettings>(`/hr/settings/${key}`, {
    method: "PUT", body: Array.isArray(body) ? { items: body } : body,
  }), "Đã lưu thiết lập");
}

// ===== Ngày / tuần (giờ máy người dùng — cửa hàng ở Việt Nam) =====

/** Date → "yyyy-MM-dd" theo giờ địa phương. */
export const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const parseIso = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };

export const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

/** Thứ hai của tuần chứa d. */
export const mondayOf = (d: Date) => addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -((d.getDay() + 6) % 7));

/** "Tuần 5 - Th. 10 2026": tuần thuộc tháng của ngày thứ năm trong tuần (như KiotViet). */
export function weekLabel(monday: Date) {
  const thu = addDays(monday, 3);
  return `Tuần ${Math.ceil(thu.getDate() / 7)} - Th. ${thu.getMonth() + 1} ${thu.getFullYear()}`;
}

/** "08:00:00" → "08:00". */
export const hm = (t: string | null | undefined) => (t ? t.slice(0, 5) : "");

/** ISO instant → "HH:mm" giờ địa phương. */
export const timeOf = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false }) : "";

/** Tải file văn bản (CSV có BOM để Excel đọc đúng tiếng Việt). */
export function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]) {
  const esc = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const blob = new Blob(["﻿" + rows.map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ===== Kỳ lương (Bảng lương / Bảng hoa hồng) =====

/** Kỳ lương hàng tháng chứa ngày d, bắt đầu từ ngày startDay (khớp PayRates.periodOf ở backend). */
export function payPeriodOf(d: Date, startDay: number): { from: string; to: string } {
  const dayIn = (y: number, m: number) => Math.min(startDay, new Date(y, m + 1, 0).getDate());
  let start = new Date(d.getFullYear(), d.getMonth(), dayIn(d.getFullYear(), d.getMonth()));
  if (start > d) start = new Date(d.getFullYear(), d.getMonth() - 1, dayIn(d.getFullYear(), d.getMonth() - 1));
  const end = addDays(new Date(start.getFullYear(), start.getMonth() + 1, start.getDate()), -1);
  return { from: isoDate(start), to: isoDate(end) };
}

/** "2025-10-01" → "01/10/2025". */
export const dmy = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "");
