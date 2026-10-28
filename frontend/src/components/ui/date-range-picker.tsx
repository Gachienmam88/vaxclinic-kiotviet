"use client";

import * as React from "react";
import { CalendarDays } from "lucide-react";
import { cn } from "cn";
import { addMonthsYmd, toYmd, ymdToDisplay } from "@/lib/date-input-format";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { MonthCalendar } from "./month-calendar";
import { PickerPopover } from "./picker-popover";

export type DateRange = { from: string; to: string };

const monthOf = (ymd: string) => `${(ymd || toYmd(new Date())).slice(0, 7)}-01`;

/** "28/10/2026 - 31/10/2026"; thiếu đầu nào thì để trống đầu đó. */
export const rangeToDisplay = (r: DateRange) => `${ymdToDisplay(r.from)} - ${ymdToDisplay(r.to)}`;

/**
 * Ô "Tùy chỉnh" khoảng ngày kiểu KiotViet: bấm mở lịch 2 tháng, bấm ngày đầu rồi ngày cuối.
 * `value` null → hiện `placeholder` (chưa ở chế độ tùy chỉnh). Giá trị "yyyy-MM-dd" như `<input type="date">`.
 */
export function DateRangePicker({ value, onChange, placeholder: placeholderProp, className, disabled, min, max, "aria-label": ariaLabelProp }: {
  value: DateRange | null;
  onChange: (range: DateRange) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  min?: string;
  max?: string;
  "aria-label"?: string;
}) {
  const tc = useT(commonNs);
  const placeholder = placeholderProp ?? tc("calendar.custom");
  const ariaLabel = ariaLabelProp ?? tc("calendar.pickRange");
  const [open, setOpen] = React.useState(false);
  const [month, setMonth] = React.useState(() => monthOf(value?.from ?? ""));
  /** Ngày đầu vừa bấm, đang chờ bấm ngày cuối. */
  const [start, setStart] = React.useState<string | null>(null);
  const [hover, setHover] = React.useState<string | null>(null);
  const shown = value && (value.from || value.to) ? rangeToDisplay(value) : "";

  const toggle = (o: boolean) => {
    if (o) { setMonth(monthOf(value?.from ?? "")); setStart(null); }
    setOpen(o);
  };
  const pick = (ymd: string) => {
    if (!start) { setStart(ymd); return; }
    onChange(ymd < start ? { from: ymd, to: start } : { from: start, to: ymd });
    setStart(null);
    setOpen(false);
  };
  const end = hover ?? start;
  const range = start && end ? (end < start ? { from: end, to: start } : { from: start, to: end })
    : value?.from && value?.to ? value : undefined;
  const cal = { onMonthChange: setMonth, onPick: pick, range, min, max, onHover: setHover };

  return (
    <PickerPopover open={open} onOpenChange={toggle} label={shown ? `${ariaLabel}: ${shown}` : ariaLabel} disabled={disabled} align="start"
      triggerClassName={cn("flex h-[30px] w-full min-w-0 items-center justify-between gap-1 rounded-md border bg-background px-2 text-left text-[13px] outline-none hover:border-primary focus-visible:border-primary disabled:opacity-60", className)}
      icon={<><span className={cn("truncate", !shown && "text-foreground")}>{shown || placeholder}</span><CalendarDays className="size-4 shrink-0 text-muted-foreground" /></>}>
      <div className="flex flex-col gap-3 sm:flex-row">
        <MonthCalendar month={month} nav="prev" {...cal} />
        <MonthCalendar month={addMonthsYmd(month, 1)} nav="next" {...cal} onMonthChange={(m) => setMonth(addMonthsYmd(m, -1))} />
      </div>
      <p className="mt-1 border-t pt-1.5 text-[12px] text-muted-foreground">
        {start ? tc("calendar.rangeHintEnd", { date: ymdToDisplay(start) }) : tc("calendar.rangeHintStart")}
      </p>
    </PickerPopover>
  );
}
