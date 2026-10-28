"use client";

import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { hrNs } from "@/messages/hr";

/** Ô nhập số kiểu KiotViet có đơn vị đứng sau (VD "0 phút", "8 giờ"), cao 26px, căn phải. */
export function UnitBox({ value, onChange, unit, disabled, label, width = 60, step }: {
  value: number; onChange: (v: number) => void; unit: string; disabled?: boolean; label: string; width?: number; step?: number;
}) {
  return (
    <span className={cn("inline-flex h-[26px] items-center gap-1 rounded-md border border-[#d9dbe0] bg-white px-2 text-[12px]",
      disabled && "bg-[#f0f2f5] text-muted-foreground")}>
      <input type="number" min={0} step={step ?? 1} aria-label={label} disabled={disabled} value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value))} style={{ width }}
        className="bg-transparent text-right outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
      <span>{unit}</span>
    </span>
  );
}

/** Thời lượng tính bằng phút, nhập dạng "x giờ y phút". */
export function DurationBox({ minutes, onChange, disabled, label }: {
  minutes: number; onChange: (m: number) => void; disabled?: boolean; label: string;
}) {
  const t = useT(hrNs);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return (
    <span className="inline-flex items-center gap-1">
      <UnitBox label={`${label} (${t("units.hour")})`} value={h} unit={t("units.hour")} width={28} disabled={disabled} onChange={(v) => onChange(Math.max(0, v) * 60 + m)} />
      <UnitBox label={`${label} (${t("units.minute")})`} value={m} unit={t("units.minute")} width={28} disabled={disabled}
        onChange={(v) => onChange(h * 60 + Math.min(59, Math.max(0, v)))} />
    </span>
  );
}

export function Hint({ text }: { text: string }) {
  return <span title={text} className="inline-flex"><Info className="size-3.5 text-muted-foreground" /></span>;
}

/** Ô check + nhãn + điều khiển phụ (VD "Tính đi muộn sau [0 phút]"). */
export function CheckLine({ checked, onChange, label, disabled, children, hint }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean; children?: React.ReactNode; hint?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3 text-[12px]", disabled && "opacity-50")}>
      <label className="flex min-w-[140px] cursor-pointer items-center gap-2">
        <input type="checkbox" className="size-3.5 accent-primary" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
        {label}
      </label>
      {children}
      {hint && <Hint text={hint} />}
    </div>
  );
}

/** Thanh lưu dính dưới cùng các trang thiết lập. */
export function SaveBar({ onSave, pending, dirty }: { onSave: () => void; pending: boolean; dirty: boolean }) {
  const t = useT(hrNs);
  const tc = useT(commonNs);
  return (
    <div className="sticky bottom-0 z-10 flex justify-end gap-2 rounded-lg bg-background px-5 py-2.5 shadow-[0_-2px_6px_rgba(0,0,0,0.05)]">
      {dirty && <span className="mr-auto self-center text-[12px] text-muted-foreground">{t("settings.unsaved")}</span>}
      <button type="button" disabled={pending || !dirty} onClick={onSave}
        className="h-8 rounded-md bg-primary px-5 text-[13px] font-semibold text-white hover:bg-primary/90 disabled:opacity-50">{tc("actions.save")}</button>
    </div>
  );
}
