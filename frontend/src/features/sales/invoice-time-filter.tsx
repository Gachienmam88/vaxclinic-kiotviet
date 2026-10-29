"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { ymd } from "@/features/dashboard/dashboard-date-utils";
import { PRESET_GROUPS, timeRange, type TimePreset } from "@/features/reports/report-time-presets";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { reportsNs } from "@/messages/reports";
import { salesNs } from "@/messages/sales";
import { FilterSection, RadioOption } from "./invoice-list-kit";
import type { InvoiceTime } from "./invoice-filter-model";

const BOX = "flex h-[30px] w-full items-center justify-between rounded-md border bg-background px-2 text-left text-[13px] hover:border-primary";
const PILL = "block h-7 w-full rounded border px-2 text-left text-xs hover:border-primary";

/**
 * Thời gian của danh sách Hóa đơn như KiotViet: (•) [Toàn thời gian / Tháng này... >] (popup mốc 3 cột + "Toàn thời gian")
 * hoặc ( ) [Tùy chỉnh] khoảng ngày.
 */
/** title: tiêu đề mục (mặc định "Thời gian"), VD Vận đơn có "Thời gian tạo" / "Thời gian hoàn thành". */
export function InvoiceTimeFilter({ value, onChange, title }: { value: InvoiceTime; onChange: (v: InvoiceTime) => void; title?: string }) {
  const t = useT(salesNs);
  const tr = useT(reportsNs); // mốc thời gian dùng chung với Báo cáo
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  const preset = value.mode === "preset" ? value.preset : value.mode === "all" ? "all" : null;
  const pick = (p: TimePreset | "all") => { onChange(p === "all" ? { mode: "all" } : { mode: "preset", preset: p }); setOpen(false); };
  const range = value.mode === "custom" ? { from: value.from, to: value.to } : null;

  return (
    <FilterSection title={title ?? t("listKit.time")}>
      <RadioOption checked={value.mode !== "custom"} onSelect={() => value.mode === "custom" && onChange({ mode: "all" })}>
        <div ref={ref} className="relative flex-1">
          <button type="button" className={BOX} onClick={() => setOpen(!open)}>
            {preset === "all" ? t("listKit.allTime") : preset ? tr(`presets.${preset}`) : t("invoices.filter.pickPreset")}
            <ChevronRight className="size-3.5 text-muted-foreground" /></button>
          {open && (
            <div className="absolute top-8 left-0 z-30 flex gap-4 rounded-md border bg-background p-3 shadow-lg">
              {PRESET_GROUPS.map((g, gi) => (
                <div key={g.id} className="w-[110px] space-y-1">
                  <p className="pb-1 text-xs font-semibold whitespace-nowrap">{tr(`presetGroups.${g.id}`)}</p>
                  {g.items.map((p) => (
                    <button key={p} type="button" onClick={() => pick(p)}
                      className={cn(PILL, preset === p && "border-primary bg-primary text-white")}>{tr(`presets.${p}`)}</button>))}
                  {gi === PRESET_GROUPS.length - 1 && (
                    <button type="button" onClick={() => pick("all")}
                      className={cn(PILL, preset === "all" && "border-primary bg-primary text-white")}>{t("listKit.allTime")}</button>)}
                </div>))}
            </div>)}
        </div>
      </RadioOption>
      <RadioOption checked={value.mode === "custom"} onSelect={() => {
        if (value.mode === "custom") return;
        const r = timeRange(value.mode === "preset" ? value : { mode: "preset", preset: "thisMonth" });
        onChange({ mode: "custom", from: ymd(r.from), to: ymd(r.to) });
      }}>
        <DateRangePicker className={BOX} value={range} onChange={(x) => onChange({ mode: "custom", ...x })} />
      </RadioOption>
    </FilterSection>
  );
}
