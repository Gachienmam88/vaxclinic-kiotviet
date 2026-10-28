"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { ymd } from "@/features/dashboard/dashboard-date-utils";
import { FILTER_FIELD, FilterSection, RadioOption } from "@/features/sales/invoice-list-kit";
import { cn } from "@/lib/utils";
import { dmy, PRESET_GROUPS, PRESET_LABELS, timeRange, type TimeValue } from "./report-time-presets";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";

const BOX = "flex h-[30px] w-full items-center justify-between rounded-md border bg-background px-2 text-left text-[13px] hover:border-primary";

/** Đóng popup khi bấm ra ngoài. */
function useOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open, close]);
  return ref;
}

/** Popup chọn mốc thời gian (3 cột như KiotViet). */
function PresetPopup({ value, onPick }: { value: string | null; onPick: (p: keyof typeof PRESET_LABELS) => void }) {
  return (
    <div className="absolute top-8 left-0 z-30 flex gap-4 rounded-md border bg-background p-3 shadow-lg">
      {PRESET_GROUPS.map((g) => (
        <div key={g.title} className="w-[110px] space-y-1">
          <p className="pb-1 text-xs font-semibold whitespace-nowrap">{g.title}</p>
          {g.items.map((p) => (
            <button key={p} type="button" onClick={() => onPick(p)}
              className={cn("block h-7 w-full rounded border px-2 text-left text-xs hover:border-primary", value === p && "border-primary bg-primary text-white")}>
              {PRESET_LABELS[p]}</button>))}
        </div>))}
    </div>
  );
}

/**
 * Bộ lọc Thời gian: (•) mốc có sẵn [Tuần này >] / ( ) Tùy chỉnh [từ – đến].
 */
export function TimeFilter({ title = "Thời gian", value, onChange }: { title?: string; value: TimeValue; onChange: (v: TimeValue) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useOutside(open, () => setOpen(false));
  const r = timeRange(value);
  return (
    <FilterSection title={title}>
      <RadioOption checked={value.mode === "preset"} onSelect={() => onChange({ mode: "preset", preset: value.mode === "preset" ? value.preset : "thisWeek" })}>
        <div ref={ref} className="relative flex-1">
          <button type="button" className={BOX} onClick={() => setOpen(!open)}>
            {value.mode === "preset" ? PRESET_LABELS[value.preset] : "Chọn mốc"} <ChevronRight className="size-3.5 text-muted-foreground" /></button>
          {open && <PresetPopup value={value.mode === "preset" ? value.preset : null}
            onPick={(preset) => { onChange({ mode: "preset", preset }); setOpen(false); }} />}
        </div>
      </RadioOption>
      <RadioOption checked={value.mode === "custom"} onSelect={() => onChange({ mode: "custom", from: ymd(r.from), to: ymd(r.to) })}>
        <DateRangePicker className={BOX} value={value.mode === "custom" ? { from: ymd(r.from), to: ymd(r.to) } : null}
          onChange={(x) => onChange({ mode: "custom", ...x })} />
      </RadioOption>
    </FilterSection>
  );
}

/** Thời gian của Báo cáo cuối ngày: 1 ngày + Từ/Đến giờ, hoặc Tùy chỉnh khoảng ngày. */
export type DayValue = { mode: "day"; day: string; fromTime: string; toTime: string } | { mode: "custom"; from: string; to: string };

/** [from, to) theo giờ địa phương. */
export function dayRange(v: DayValue): { from: Date; to: Date; label: string } {
  if (v.mode === "custom") {
    const r = timeRange({ mode: "custom", from: v.from, to: v.to });
    return { from: r.from, to: new Date(r.to.getFullYear(), r.to.getMonth(), r.to.getDate() + 1), label: `${dmy(r.from)} - ${dmy(r.to)}` };
  }
  const d = new Date(`${v.day}T00:00:00`);
  const at = (t: string, fallback: number) => (t ? new Date(`${v.day}T${t}:00`) : new Date(d.getTime() + fallback));
  const label = dmy(d) + (v.fromTime || v.toTime ? ` (${v.fromTime || "00:00"} - ${v.toTime || "24:00"})` : "");
  return { from: at(v.fromTime, 0), to: v.toTime ? new Date(at(v.toTime, 0).getTime() + 60_000) : new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1), label };
}

export function DayFilter({ value, onChange }: { value: DayValue; onChange: (v: DayValue) => void }) {
  const today = ymd(new Date());
  const day = value.mode === "day" ? value : { mode: "day" as const, day: today, fromTime: "", toTime: "" };
  const tf = "h-[30px] w-full rounded-md border bg-background px-1.5 text-[13px] outline-none focus-visible:border-primary";
  return (
    <FilterSection title="Thời gian">
      <RadioOption checked={value.mode === "day"} onSelect={() => onChange(day)}>
        <DatePicker aria-label="Ngày" className={FILTER_FIELD} value={day.day} onChange={(v) => v && onChange({ ...day, day: v })} />
      </RadioOption>
      <div className="grid grid-cols-2 gap-1.5 pl-6">
        <TimePicker aria-label="Từ giờ" title="Từ" placeholder="Từ" className={tf} value={day.fromTime} disabled={value.mode !== "day"}
          onChange={(v) => onChange({ ...day, fromTime: v })} />
        <TimePicker aria-label="Đến giờ" title="Đến" placeholder="Đến" className={tf} value={day.toTime} disabled={value.mode !== "day"}
          onChange={(v) => onChange({ ...day, toTime: v })} />
      </div>
      <RadioOption checked={value.mode === "custom"} onSelect={() => onChange({ mode: "custom", from: day.day, to: day.day })}>
        <DateRangePicker className={BOX} value={value.mode === "custom" ? value : null} onChange={(x) => onChange({ mode: "custom", ...x })} />
      </RadioOption>
    </FilterSection>
  );
}

