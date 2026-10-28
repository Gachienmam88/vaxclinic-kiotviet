"use client";

import { ChevronDown } from "lucide-react";
import { PERIOD_LABELS, type DashPeriod } from "./dashboard-date-utils";

/** Ô chọn kỳ nhỏ (26px) ở góc phải thẻ: Hôm nay / Hôm qua / 7 ngày qua / Tháng này / Tháng trước. */
export function DashboardPeriodSelect({ value, onChange, label, options = Object.keys(PERIOD_LABELS) as DashPeriod[] }: {
  value: DashPeriod; onChange: (p: DashPeriod) => void; label: string; options?: DashPeriod[];
}) {
  return (
    <div className="relative">
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value as DashPeriod)}
        className="h-[26px] cursor-pointer appearance-none rounded-md border border-[#d5d9df] bg-background pr-6 pl-2 text-xs outline-none focus:border-primary">
        {options.map((p) => <option key={p} value={p}>{PERIOD_LABELS[p]}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute top-[7px] right-1.5 size-3" aria-hidden />
    </div>
  );
}
