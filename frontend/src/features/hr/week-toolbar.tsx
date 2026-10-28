"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { addDays, isoDate, mondayOf, weekLabel } from "./hr-queries";
import type { EmployeeRow } from "./hr-types";
import { WEEKDAY_LONG } from "./hr-types";

/** Thanh công cụ dùng chung cho Lịch làm việc / Bảng chấm công (ảnh KiotViet 112, 113). */

/** Nút viền xám trắng cao 30px (Tuần này, Import, Xuất file, Chọn…). */
export const WEEK_BTN = "flex h-[30px] items-center gap-1.5 rounded-md border border-[#d9dbe0] bg-white px-2.5 text-[12px] font-semibold hover:border-primary hover:text-primary";

/** 7 ngày của tuần bắt đầu từ thứ hai: { iso, date, label }. */
export function weekDays(monday: Date) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(monday, i);
    return { iso: isoDate(d), day: d.getDate(), label: WEEKDAY_LONG[i] };
  });
}

/** ‹ Tuần 5 - Th. 10 2026 › */
export function WeekNavigator({ monday, onChange }: { monday: Date; onChange: (d: Date) => void }) {
  const arrow = "flex h-full w-6 items-center justify-center text-muted-foreground hover:text-primary";
  return (
    <div className="flex h-[30px] items-center rounded-md border border-[#d9dbe0] bg-white text-[12px]">
      <button type="button" aria-label="Tuần trước" className={cn(arrow, "border-r border-[#d9dbe0]")} onClick={() => onChange(addDays(monday, -7))}>
        <ChevronLeft className="size-3.5" /></button>
      <span className="px-2 whitespace-nowrap">{weekLabel(monday)}</span>
      <button type="button" aria-label="Tuần sau" className={cn(arrow, "border-l border-[#d9dbe0]")} onClick={() => onChange(addDays(monday, 7))}>
        <ChevronRight className="size-3.5" /></button>
    </div>
  );
}

/** Ô "Tìm kiếm nhân viên" dạng combobox: gõ để lọc, chọn 1 nhân viên hoặc bỏ chọn. value = id nhân viên ("" = tất cả). */
export function EmployeeSearch({ employees, value, onChange }: {
  employees: EmployeeRow[]; value: string; onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const selected = employees.find((e) => e.id === value);
  const term = q.trim().toLowerCase();
  const list = employees.filter((e) => !term || `${e.code} ${e.name}`.toLowerCase().includes(term)).slice(0, 50);
  return (
    <div ref={ref} className="relative w-[162px]">
      <Search className="absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <input role="combobox" aria-expanded={open} aria-controls="hr-employee-search-list" aria-label="Tìm kiếm nhân viên" placeholder="Tìm kiếm nhân viên"
        className="h-[30px] w-full rounded-md border border-[#d9dbe0] bg-white pr-6 pl-7 text-[12px] outline-none placeholder:text-muted-foreground focus:border-primary"
        value={open ? q : selected?.name ?? ""} onFocus={() => { setOpen(true); setQ(""); }} onChange={(e) => setQ(e.target.value)} />
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2 text-foreground" />
      {open && (
        <ul id="hr-employee-search-list" role="listbox" className="absolute top-8 left-0 z-30 max-h-72 w-64 overflow-y-auto rounded-md border bg-white py-1 text-[12px] shadow-lg">
          <li><button type="button" className="w-full px-3 py-1.5 text-left hover:bg-[#f3f6fa]" onClick={() => { onChange(""); setOpen(false); }}>
            Tất cả nhân viên</button></li>
          {list.map((e) => (
            <li key={e.id}><button type="button" role="option" aria-selected={e.id === value}
              className={cn("w-full px-3 py-1.5 text-left hover:bg-[#f3f6fa]", e.id === value && "text-primary")}
              onClick={() => { onChange(e.id); setOpen(false); }}>
              <span className="font-medium">{e.name}</span> <span className="text-muted-foreground">{e.code}</span></button></li>
          ))}
          {!list.length && <li className="px-3 py-1.5 text-muted-foreground">Không tìm thấy nhân viên</li>}
        </ul>
      )}
    </div>
  );
}

/** Ô chọn kiểu nút (Xem theo nhân viên / Xem theo ca, Theo tuần). */
export function ViewSelect<T extends string>({ value, options, onChange, icon, label }: {
  value: T; options: [T, string][]; onChange: (v: T) => void; icon?: React.ReactNode; label: string;
}) {
  return (
    <label className="relative flex h-[30px] items-center rounded-md border border-[#d9dbe0] bg-white text-[12px] font-semibold hover:border-primary">
      {icon && <span className="pointer-events-none absolute left-2.5">{icon}</span>}
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value as T)}
        className={cn("h-full cursor-pointer appearance-none bg-transparent pr-7 outline-none", icon ? "pl-7" : "pl-2.5")}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 size-3.5" />
    </label>
  );
}

/** Tiêu đề cột ngày: "Thứ tư (28)" — hôm nay chữ xanh, số ngày trong vòng tròn xanh. */
export function DayHeader({ label, day, today, pad }: { label: string; day: number; today: boolean; pad?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-[12px] font-normal", today ? "text-primary" : "text-muted-foreground")}>
      {label}
      <span className={cn("inline-flex min-w-5 items-center justify-center font-semibold",
        today ? "size-5 rounded-full bg-primary text-[11px] text-white" : "text-foreground")}>{pad ? String(day).padStart(2, "0") : day}</span>
    </span>
  );
}

export const todayIso = () => isoDate(new Date());
export const thisMonday = () => mondayOf(new Date());
