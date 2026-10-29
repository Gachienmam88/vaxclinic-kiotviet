"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { PickerPopover } from "@/components/ui/picker-popover";
import { useT } from "@/lib/i18n";
import { ordersNs } from "@/messages/orders";
import { ORDER_STATUS_KEY, type OrderStatus } from "./order-types";

const ALL: OrderStatus[] = ["DRAFT", "CONFIRMED", "COMPLETED", "CANCELLED"];
const SHOWN = 3;

/** Trạng thái dạng thẻ (KiotViet): thẻ tím có ×, quá 3 thẻ → "+N khác"; bấm ô mở danh sách chọn thêm. */
export function OrderStatusChips({ value, onChange }: { value: OrderStatus[]; onChange: (v: OrderStatus[]) => void }) {
  const t = useT(ordersNs);
  const [open, setOpen] = useState(false);
  const rest = ALL.filter((s) => !value.includes(s));
  return (
    <PickerPopover open={open} onOpenChange={setOpen} label={t("kv.pickStatus")} align="start" className="w-[200px] p-1.5"
      triggerClassName="flex min-h-[86px] w-full flex-wrap content-start items-start gap-1 rounded-md border bg-background p-1.5 text-left hover:border-primary data-popup-open:border-primary"
      icon={<>
        {!value.length && <span className="px-1 text-[13px] text-muted-foreground">{t("kv.pickStatus")}</span>}
        {value.slice(0, SHOWN).map((s) => (
          <span key={s} className="flex h-6 items-center gap-1 rounded bg-primary px-2 text-xs font-medium text-white">{t(ORDER_STATUS_KEY[s])}
            <X className="size-3" aria-label={t(ORDER_STATUS_KEY[s])} onClick={(e) => { e.stopPropagation(); onChange(value.filter((x) => x !== s)); }} /></span>))}
        {value.length > SHOWN && <span className="flex h-6 items-center rounded bg-primary-tint px-2 text-xs">{t("kv.more", { n: value.length - SHOWN })}</span>}
      </>}>
      {rest.length ? rest.map((s, i) => (
        <button key={s} type="button" data-picker-focus={i === 0 ? "" : undefined} onClick={() => onChange([...value, s])}
          className="block h-8 w-full rounded px-2.5 text-left text-[13px] hover:bg-muted">{t(ORDER_STATUS_KEY[s])}</button>))
        : <p className="px-2.5 py-1.5 text-[13px] text-muted-foreground">—</p>}
    </PickerPopover>
  );
}
