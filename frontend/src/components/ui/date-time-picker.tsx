"use client";

import * as React from "react";
import { CalendarDays, Clock } from "lucide-react";
import { dateTimeToDisplay, DATETIME_MASK, displayToDateTime, pad2, toLocalDateTime, toYmd } from "@/lib/date-input-format";
import { useMaskedDateText } from "@/lib/use-masked-date-text";
import { TodayButton, type PickerInputProps } from "./date-picker";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { MonthCalendar } from "./month-calendar";
import { PICKER_INPUT, PickerFieldShell, PickerPopover } from "./picker-popover";
import { TimeListPanel } from "./time-list-panel";

const nowHm = () => { const d = new Date(); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };

/**
 * Ô chọn ngày giờ kiểu KiotViet "dd/MM/yyyy HH:mm" (24h), icon lịch + đồng hồ bên phải.
 * `value` nhận "yyyy-MM-ddTHH:mm" (hoặc ISO); `onChange` trả "yyyy-MM-ddTHH:mm" giờ địa phương ("" khi xóa)
 * — giống hệt `<input type="datetime-local">`.
 */
export function DateTimePicker({ value, onChange, className, disabled, placeholder = "dd/mm/yyyy --:--", ...rest }: PickerInputProps & {
  value: string | null | undefined;
  onChange: (value: string) => void;
}) {
  const tc = useT(commonNs);
  const field = React.useRef<HTMLDivElement>(null);
  const [open, setOpen] = React.useState<"date" | "time" | null>(null);
  const local = toLocalDateTime(value) ?? "";
  const [month, setMonth] = React.useState(() => `${(local || toYmd(new Date())).slice(0, 7)}-01`);
  const t = useMaskedDateText({ value: local, onChange, mask: DATETIME_MASK, format: dateTimeToDisplay, parse: displayToDateTime });
  const ymd = local.slice(0, 10);
  const hm = local.slice(11, 16);

  const toggle = (kind: "date" | "time") => (o: boolean) => {
    if (o && kind === "date") setMonth(`${(ymd || toYmd(new Date())).slice(0, 7)}-01`);
    setOpen(o ? kind : null);
  };
  const pickDay = (d: string) => { t.commit(`${d}T${hm || nowHm()}`); setOpen(null); };

  return (
    <PickerFieldShell fieldRef={field} className={className} invalid={t.invalid} disabled={disabled}>
      <input {...rest} type="text" inputMode="numeric" autoComplete="off" className={PICKER_INPUT} disabled={disabled}
        placeholder={placeholder} value={t.text} aria-invalid={t.invalid || undefined} onChange={t.onInputChange} onBlur={t.onBlur}
        onKeyDown={(e) => { if (e.altKey && e.key === "ArrowDown") { e.preventDefault(); toggle("date")(true); } }} />
      <PickerPopover open={open === "date"} onOpenChange={toggle("date")} anchor={field} icon={<CalendarDays />} label={tc("calendar.pickDate")} disabled={disabled}>
        <MonthCalendar month={month} onMonthChange={setMonth} selected={ymd || undefined} onPick={pickDay} />
        <TodayButton onClick={() => pickDay(toYmd(new Date()))} />
      </PickerPopover>
      <PickerPopover open={open === "time"} onOpenChange={toggle("time")} anchor={field} icon={<Clock />} label={tc("calendar.pickTime")} disabled={disabled}>
        <TimeListPanel value={hm} onPick={(h, done) => { t.commit(`${ymd || toYmd(new Date())}T${h}`); if (done) setOpen(null); }} />
      </PickerPopover>
    </PickerFieldShell>
  );
}
