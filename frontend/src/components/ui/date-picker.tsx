"use client";

import * as React from "react";
import { CalendarDays } from "lucide-react";
import { DATE_MASK, displayToYmd, toYmd, ymdInRange, ymdToDisplay } from "@/lib/date-input-format";
import { useMaskedDateText } from "@/lib/use-masked-date-text";
import { MonthCalendar } from "./month-calendar";
import { PICKER_INPUT, PickerFieldShell, PickerPopover } from "./picker-popover";

export type PickerInputProps = {
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
  title?: string;
  autoFocus?: boolean;
  "aria-label"?: string;
};

const monthOf = (ymd: string) => `${(ymd || toYmd(new Date())).slice(0, 7)}-01`;

/** Nút "Hôm nay" ở chân lịch. */
export function TodayButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <div className="mt-1 flex justify-end border-t pt-1.5">
      <button type="button" disabled={disabled} onClick={onClick}
        className="h-7 rounded px-2 text-[13px] font-medium text-primary outline-none hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-primary/60 disabled:opacity-40">
        Hôm nay
      </button>
    </div>
  );
}

/**
 * Ô chọn ngày kiểu KiotViet: hiển thị dd/MM/yyyy, gõ trực tiếp hoặc bấm icon lịch.
 * `value`/`onChange` dùng "yyyy-MM-dd" ("" khi xóa) — giống hệt `<input type="date">`.
 */
export function DatePicker({ value, onChange, min, max, className, disabled, placeholder = "dd/mm/yyyy", ...rest }: PickerInputProps & {
  value: string | null | undefined;
  onChange: (ymd: string) => void;
  min?: string;
  max?: string;
}) {
  const field = React.useRef<HTMLDivElement>(null);
  const [open, setOpen] = React.useState(false);
  const [month, setMonth] = React.useState(() => monthOf(value ?? ""));
  const t = useMaskedDateText({
    value, onChange, mask: DATE_MASK, format: ymdToDisplay, parse: displayToYmd, allowed: (v) => ymdInRange(v, min, max),
  });
  const openCalendar = (o: boolean) => {
    if (o) setMonth(monthOf(value ?? ""));
    setOpen(o);
  };
  const pick = (ymd: string) => { t.commit(ymd); setOpen(false); };
  const today = toYmd(new Date());

  return (
    <PickerFieldShell fieldRef={field} className={className} invalid={t.invalid} disabled={disabled}>
      <input {...rest} type="text" inputMode="numeric" autoComplete="off" className={PICKER_INPUT} disabled={disabled}
        placeholder={placeholder} value={t.text} aria-invalid={t.invalid || undefined} onChange={t.onInputChange} onBlur={t.onBlur}
        onKeyDown={(e) => { if (e.altKey && e.key === "ArrowDown") { e.preventDefault(); openCalendar(true); } }} />
      <PickerPopover open={open} onOpenChange={openCalendar} anchor={field} icon={<CalendarDays />} label="Chọn ngày" disabled={disabled}>
        <MonthCalendar month={month} onMonthChange={setMonth} selected={value ?? undefined} min={min} max={max} onPick={pick} />
        <TodayButton disabled={!ymdInRange(today, min, max)} onClick={() => pick(today)} />
      </PickerPopover>
    </PickerFieldShell>
  );
}
