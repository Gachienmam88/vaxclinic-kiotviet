"use client";

import { useState } from "react";
import { ListChecks } from "lucide-react";
import { PickerPopover } from "@/components/ui/picker-popover";
import { useT } from "@/lib/i18n";
import { salesNs } from "@/messages/sales";
import { INVOICE_COLUMNS, type InvoiceColumn } from "./invoice-list-prefs";

const ICON_BTN = "inline-flex size-[30px] items-center justify-center rounded-md border bg-background text-foreground hover:border-primary hover:text-primary data-popup-open:border-primary data-popup-open:text-primary";
const ROWS = Math.ceil((INVOICE_COLUMNS.length + 1) / 3);

/** Chọn cột hiển thị kiểu KiotViet: lưới 3 cột checkbox (xếp theo cột), "Mã hóa đơn" luôn hiện. */
export function InvoiceColumnPicker({ shown, onToggle }: { shown: (c: InvoiceColumn) => boolean; onToggle: (c: InvoiceColumn, on: boolean) => void }) {
  const t = useT(salesNs);
  const [open, setOpen] = useState(false);
  const box = "size-4 shrink-0 rounded accent-primary";
  return (
    <PickerPopover open={open} onOpenChange={setOpen} label={t("invoices.toolbar.columns")} align="end" triggerClassName={ICON_BTN}
      icon={<ListChecks className="size-4" />} className="w-[560px] p-3">
      <div className="grid grid-flow-col gap-x-4 gap-y-1" style={{ gridTemplateRows: `repeat(${ROWS}, minmax(0, auto))` }}>
        <label className="flex h-[26px] items-center gap-2 text-muted-foreground">
          <input type="checkbox" className={box} checked disabled /> {t("invoices.columns.code")}
        </label>
        {INVOICE_COLUMNS.map(([k], i) => (
          <label key={k} className="flex h-[26px] cursor-pointer items-center gap-2">
            <input type="checkbox" className={box} checked={shown(k)} data-picker-focus={i === 0 ? "" : undefined}
              onChange={(e) => onToggle(k, e.target.checked)} /> {t(`invoices.columns.${k}`)}
          </label>))}
      </div>
    </PickerPopover>
  );
}
