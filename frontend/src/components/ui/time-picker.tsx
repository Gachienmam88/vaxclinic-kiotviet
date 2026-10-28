"use client";

import * as React from "react";
import { Clock } from "lucide-react";
import { normalizeHm, TIME_MASK } from "@/lib/date-input-format";
import { useMaskedDateText } from "@/lib/use-masked-date-text";
import type { PickerInputProps } from "./date-picker";
import { PICKER_INPUT, PickerFieldShell, PickerPopover } from "./picker-popover";
import { TimeListPanel } from "./time-list-panel";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";

/**
 * Ô chọn giờ 24h "HH:mm": gõ trực tiếp hoặc bấm icon đồng hồ để chọn giờ/phút.
 * `value`/`onChange` dùng "HH:mm" ("" khi xóa) — giống `<input type="time">`.
 */
export function TimePicker({ value, onChange, className, disabled, placeholder = "--:--", ...rest }: PickerInputProps & {
  value: string | null | undefined;
  onChange: (hm: string) => void;
}) {
  const tc = useT(commonNs);
  const field = React.useRef<HTMLDivElement>(null);
  const [open, setOpen] = React.useState(false);
  const t = useMaskedDateText({ value, onChange, mask: TIME_MASK, format: (v) => normalizeHm(v) ?? "", parse: normalizeHm });

  return (
    <PickerFieldShell fieldRef={field} className={className} invalid={t.invalid} disabled={disabled}>
      <input {...rest} type="text" inputMode="numeric" autoComplete="off" className={PICKER_INPUT} disabled={disabled}
        placeholder={placeholder} value={t.text} aria-invalid={t.invalid || undefined} onChange={t.onInputChange} onBlur={t.onBlur}
        onKeyDown={(e) => { if (e.altKey && e.key === "ArrowDown") { e.preventDefault(); setOpen(true); } }} />
      <PickerPopover open={open} onOpenChange={setOpen} anchor={field} icon={<Clock />} label={tc("calendar.pickTime")} disabled={disabled}>
        <TimeListPanel value={normalizeHm(value) ?? ""} onPick={(hm, done) => { t.commit(hm); if (done) setOpen(false); }} />
      </PickerPopover>
    </PickerFieldShell>
  );
}
