"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { PickerPopover } from "@/components/ui/picker-popover";
import { useT } from "@/lib/i18n";
import { useVnAdmin } from "@/lib/vn-admin-data";
import { searchUnits, type VnUnit } from "@/lib/vn-admin-search";
import { ordersNs } from "@/messages/orders";

const SHOWN = 3;

/**
 * "Khu vực giao hàng" (KiotViet): chọn nhiều Tỉnh/Thành hoặc Phường/Xã (tìm không dấu), thẻ có ×, quá 3 thẻ → "+N khác".
 * value = mã ĐVHC (tỉnh 2 số, phường/xã 5 số); server lọc theo khu vực giao hàng lưu trên đơn.
 */
export function OrderAreaFilter({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const t = useT(ordersNs);
  const vn = useVnAdmin();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const label = (code: string) => {
    const w = vn?.wardByCode.get(code);
    if (w) return `${w.name} - ${vn?.provinceByCode.get(w.provinceCode ?? "")?.name ?? ""}`;
    return vn?.provinceByCode.get(code)?.name ?? code;
  };
  const options = useMemo<VnUnit[]>(() => {
    if (!vn) return [];
    const units = q.trim() ? [...searchUnits(vn.provinces, q, 20), ...searchUnits(vn.wards, q, 80)] : vn.provinces;
    return units.filter((u) => !value.includes(u.code));
  }, [vn, q, value]);
  return (
    <PickerPopover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQ(""); }} label={t("kv.area")} align="start" className="w-[280px] p-1.5"
      triggerClassName="flex min-h-[34px] w-full flex-wrap content-start items-start gap-1 rounded-md border bg-background p-1.5 text-left hover:border-primary data-popup-open:border-primary"
      icon={<>
        {!value.length && <span className="px-1 text-[13px] text-muted-foreground">{t("kv.areaPh")}</span>}
        {value.slice(0, SHOWN).map((c) => (
          <span key={c} className="flex h-6 max-w-full items-center gap-1 rounded bg-primary px-2 text-xs font-medium text-white">
            <span className="truncate">{label(c)}</span>
            <X className="size-3 shrink-0" aria-label={label(c)} onClick={(e) => { e.stopPropagation(); onChange(value.filter((x) => x !== c)); }} /></span>))}
        {value.length > SHOWN && <span className="flex h-6 items-center rounded bg-primary-tint px-2 text-xs">{t("kv.more", { n: value.length - SHOWN })}</span>}
      </>}>
      <input data-picker-focus="" className="mb-1 h-8 w-full rounded border px-2 text-[13px] outline-none focus:border-primary" value={q}
        placeholder={t("kv.areaSearch")} aria-label={t("kv.areaSearch")} onChange={(e) => setQ(e.target.value)} />
      <div className="max-h-[260px] overflow-y-auto">
        {options.map((u) => (
          <button key={u.code} type="button" onClick={() => onChange([...value, u.code])}
            className="block w-full rounded px-2.5 py-1.5 text-left text-[13px] hover:bg-muted">{label(u.code)}</button>))}
        {vn && !options.length && <p className="px-2.5 py-1.5 text-[13px] text-muted-foreground">—</p>}
      </div>
    </PickerPopover>
  );
}
