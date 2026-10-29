"use client";

import { useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { PickerPopover } from "@/components/ui/picker-popover";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { deliveryNs } from "@/messages/delivery";
import { SHIPMENT_STATUS_KEY, SHIPMENT_STATUSES } from "./delivery-types";

/** Ô chọn nhiều trạng thái giao hàng: "Chọn trạng thái" → danh sách checkbox; đã chọn hiện dạng thẻ có ×. */
export function ShipmentStatusSelect({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const t = useT(deliveryNs);
  const [open, setOpen] = useState(false);
  const label = (k: string) => t(SHIPMENT_STATUS_KEY[k as keyof typeof SHIPMENT_STATUS_KEY]);
  return (
    <PickerPopover open={open} onOpenChange={setOpen} label={placeholder} align="start" className="w-[230px] p-2"
      triggerClassName="flex min-h-[30px] w-full flex-wrap items-center gap-1 rounded-md border bg-background px-2 py-1 text-left text-[13px] hover:border-primary data-popup-open:border-primary"
      icon={<>
        {!value.length && <span className="flex-1 text-muted-foreground">{placeholder}</span>}
        {value.map((k) => (
          <span key={k} className="flex items-center gap-1 rounded bg-primary-tint px-1.5 text-xs">{label(k)}
            <X className="size-3" aria-label={label(k)} onClick={(e) => { e.stopPropagation(); onChange(value.filter((x) => x !== k)); }} /></span>))}
        <ChevronDown className={cn("ml-auto size-3.5 text-muted-foreground", !value.length && "ml-0")} />
      </>}>
      <div className="max-h-72 space-y-0.5 overflow-y-auto">
        {SHIPMENT_STATUSES.map(([k], i) => (
          <label key={k} className="flex h-7 cursor-pointer items-center gap-2 rounded px-1.5 text-[13px] hover:bg-muted">
            <input type="checkbox" className="size-4 accent-primary" checked={value.includes(k)} data-picker-focus={i === 0 ? "" : undefined}
              onChange={(e) => onChange(e.target.checked ? [...value, k] : value.filter((x) => x !== k))} />{label(k)}
          </label>))}
      </div>
    </PickerPopover>
  );
}
