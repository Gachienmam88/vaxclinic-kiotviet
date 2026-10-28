"use client";

import { useState } from "react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { NumberInput } from "@/components/number-input";
import { usePrintTemplates } from "@/features/print/print-data";
import { underlineInput } from "./sale-ui-parts";
import { useSaleSettings } from "./use-sale-settings";
import type { SaleSettings } from "./sale-settings";

type PrintDraft = Pick<SaleSettings, "autoPrint" | "mergePrintLines" | "printCopies" | "printTemplate">;

/**
 * Icon máy in trên thanh xanh → "Thiết lập in" (lưu theo máy): Tự động in hóa đơn, Gộp hàng cùng loại, Số bản in (Liên),
 * Chọn mẫu in (mẫu in hóa đơn của cửa hàng — Thiết lập → Mẫu in; chưa sửa thì dùng mẫu mặc định). Bỏ qua = không lưu.
 */
export function SalePrintSettingsPopover() {
  const { settings, set } = useSaleSettings();
  const { data: templates } = usePrintTemplates();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<PrintDraft>(settings);
  const row = "flex h-8 items-center justify-between gap-6";

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={(o) => { setOpen(o); if (o) setF(settings); }}>
      <PopoverPrimitive.Trigger aria-label="Thiết lập in" title="Thiết lập in"
        className="grid size-8 shrink-0 place-items-center rounded-md hover:bg-white/10 data-popup-open:bg-white/15">
        <Printer className="size-5" />
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner className="z-50" side="bottom" align="end" sideOffset={6}>
          <PopoverPrimitive.Popup aria-label="Thiết lập in"
            className="w-[324px] rounded-md bg-popover px-5 pt-3 pb-4 text-[13px] text-popover-foreground shadow-lg ring-1 ring-foreground/10 outline-none">
            <label className={row}>Tự động in hóa đơn
              <Switch checked={f.autoPrint} onCheckedChange={(autoPrint) => setF({ ...f, autoPrint })} /></label>
            <label className={row}>Gộp hàng cùng loại
              <Switch checked={f.mergePrintLines} onCheckedChange={(mergePrintLines) => setF({ ...f, mergePrintLines })} /></label>
            <label className={row}>Số bản in (Liên)
              <NumberInput aria-label="Số bản in" className={`${underlineInput} w-10`} value={f.printCopies}
                onValueChange={(v) => setF({ ...f, printCopies: Math.min(Math.max(Math.round(v) || 1, 1), 10) })} /></label>
            <p className="mt-3 mb-2">Chọn mẫu in</p>
            <button type="button" aria-pressed={f.printTemplate === "INVOICE"} onClick={() => setF({ ...f, printTemplate: "INVOICE" })}
              title={templates?.INVOICE ? "Mẫu in hóa đơn của cửa hàng" : "Mẫu in hóa đơn mặc định"}
              className="h-8 rounded-full bg-primary px-4 font-semibold text-white">A. Mẫu in hóa đơn</button>
            <div className="mt-4 flex gap-3 border-t border-dashed border-[#c8ccd2] pt-3">
              <Button variant="outline" className="h-9 border-primary px-5 text-primary" onClick={() => setOpen(false)}>Bỏ qua</Button>
              <Button className="h-9 px-6" onClick={() => { set(f); setOpen(false); }}>Xong</Button>
            </div>
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
