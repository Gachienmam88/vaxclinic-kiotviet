"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "cn";
import { addDaysYmd, addMonthsYmd, monthMatrix, parseYmd, toYmd, ymdInRange } from "@/lib/date-input-format";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";

/** Thứ tự cột T2…CN (khóa trong common.calendar.weekdaysShort). */
const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

const NAV = "inline-flex size-7 items-center justify-center rounded text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 [&_svg]:size-4";

export type MonthCalendarProps = {
  /** Ngày đầu tháng đang xem, "yyyy-MM-dd". */
  month: string;
  onMonthChange: (month: string) => void;
  onPick: (ymd: string) => void;
  /** Ngày đang chọn (đánh dấu xanh). */
  selected?: string;
  /** Khoảng đang chọn (tô nền nhạt giữa from–to). */
  range?: { from: string; to: string };
  min?: string;
  max?: string;
  /** Ẩn nút sang tháng trước / sau (dùng cho lịch 2 tháng). */
  nav?: "both" | "prev" | "next";
  onHover?: (ymd: string | null) => void;
};

/** Lịch 1 tháng kiểu KiotViet: T2…CN, điều hướng tháng/năm, phím mũi tên để di chuyển ngày, Enter để chọn. */
export function MonthCalendar({ month, onMonthChange, onPick, selected, range, min, max, nav = "both", onHover }: MonthCalendarProps) {
  const first = parseYmd(month) ?? new Date();
  const y = first.getFullYear();
  const m = first.getMonth();
  const tc = useT(commonNs);
  const today = toYmd(new Date());
  const days = monthMatrix(y, m);
  const inMonth = (ymd: string) => ymd.slice(0, 7) === month.slice(0, 7);
  const [focused, setFocused] = React.useState(() => [selected, today].find((d) => d && inMonth(d)) ?? month);
  const focusDay = inMonth(focused) ? focused : month;
  const grid = React.useRef<HTMLDivElement>(null);
  const keyMoved = React.useRef(false);

  React.useEffect(() => {
    if (!keyMoved.current) return;
    keyMoved.current = false;
    grid.current?.querySelector<HTMLElement>(`[data-ymd="${focusDay}"]`)?.focus();
  }, [focusDay]);

  const move = (to: string) => {
    keyMoved.current = true;
    setFocused(to);
    if (!inMonth(to)) onMonthChange(`${to.slice(0, 7)}-01`);
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    const steps: Record<string, () => string> = {
      ArrowLeft: () => addDaysYmd(focusDay, -1), ArrowRight: () => addDaysYmd(focusDay, 1),
      ArrowUp: () => addDaysYmd(focusDay, -7), ArrowDown: () => addDaysYmd(focusDay, 7),
      PageUp: () => addMonthsYmd(focusDay, e.shiftKey ? -12 : -1), PageDown: () => addMonthsYmd(focusDay, e.shiftKey ? 12 : 1),
      Home: () => addDaysYmd(focusDay, -((parseYmd(focusDay)!.getDay() + 6) % 7)),
      End: () => addDaysYmd(focusDay, 6 - ((parseYmd(focusDay)!.getDay() + 6) % 7)),
    };
    const step = steps[e.key];
    if (!step) return;
    e.preventDefault();
    move(step());
  };
  const shift = (n: number) => onMonthChange(addMonthsYmd(month, n));
  const title = tc("calendar.monthYear", { month: m + 1, year: y });

  return (
    <div className="w-[238px] select-none">
      <div className="mb-1 flex items-center gap-0.5">
        {nav !== "next" ? <>
          <button type="button" className={NAV} aria-label={tc("calendar.prevYear")} onClick={() => shift(-12)}><ChevronsLeft /></button>
          <button type="button" className={NAV} aria-label={tc("calendar.prevMonth")} onClick={() => shift(-1)}><ChevronLeft /></button>
        </> : <span className="w-[58px]" />}
        <span className="flex-1 text-center text-[13px] font-semibold" aria-live="polite">{title}</span>
        {nav !== "prev" ? <>
          <button type="button" className={NAV} aria-label={tc("calendar.nextMonth")} onClick={() => shift(1)}><ChevronRight /></button>
          <button type="button" className={NAV} aria-label={tc("calendar.nextYear")} onClick={() => shift(12)}><ChevronsRight /></button>
        </> : <span className="w-[58px]" />}
      </div>
      <div ref={grid} role="grid" aria-label={title} onKeyDown={onKeyDown} onMouseLeave={() => onHover?.(null)}>
        <div role="row" className="grid grid-cols-7">
          {WEEKDAY_KEYS.map((w) => <span key={w} role="columnheader" className="py-1 text-center text-[12px] font-medium text-muted-foreground">{tc(`calendar.weekdaysShort.${w}`)}</span>)}
        </div>
        {[0, 1, 2, 3, 4, 5].map((week) => (
          <div key={week} role="row" className="grid grid-cols-7">
            {days.slice(week * 7, week * 7 + 7).map((d) => {
              const ymd = toYmd(d);
              const enabled = ymdInRange(ymd, min, max);
              const edge = ymd === selected || (range && (ymd === range.from || ymd === range.to));
              const between = range && ymd > range.from && ymd < range.to;
              return (
                <button key={ymd} type="button" role="gridcell" data-ymd={ymd} disabled={!enabled}
                  tabIndex={ymd === focusDay ? 0 : -1} data-picker-focus={ymd === focusDay || undefined}
                  aria-selected={Boolean(edge)} aria-label={`${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`}
                  onClick={() => { setFocused(ymd); onPick(ymd); }} onMouseEnter={() => onHover?.(ymd)}
                  className={cn(
                    "h-8 rounded text-[13px] outline-none hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-primary/60 disabled:pointer-events-none disabled:opacity-35",
                    !inMonth(ymd) && "text-muted-foreground/60",
                    between && "rounded-none bg-primary/10",
                    ymd === today && !edge && "font-semibold text-primary",
                    edge && "bg-primary text-white hover:bg-primary",
                  )}>
                  {d.getDate()}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
