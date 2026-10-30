"use client";

import { useMemo, useRef, useState } from "react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { Eye, FileText, Printer, SlidersHorizontal } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { zoomAwarePositioning } from "@/lib/zoom-aware-floating-anchor";
import { EDITOR_COLUMNS, type EditorColumn, type EditorOptions, type PrintSettings } from "./purchase-editor-options";
import { useT } from "@/lib/i18n";
import { purchasesNs } from "@/messages/purchases";

const ICON_BTN = "inline-flex size-[26px] items-center justify-center rounded-md border border-[#d1d5db] bg-background text-foreground hover:bg-muted";

/** Nút biểu tượng mở popover bên dưới (dùng chung cho 3 popover của thanh công cụ). */
function ToolPopover({ label, icon, children, width = 260 }: { label: string; icon: React.ReactNode; children: React.ReactNode; width?: number }) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  const positioning = useMemo(() => (open ? zoomAwarePositioning(() => anchor.current) : undefined), [open]);
  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger ref={anchor} type="button" aria-label={label} title={label} className={ICON_BTN}>{icon}</PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner className="isolate z-50 outline-none" {...positioning} side="bottom" align="end" sideOffset={6}>
          <PopoverPrimitive.Popup aria-label={label} style={{ width }}
            className="rounded-lg border bg-popover p-3 text-[13px] text-popover-foreground shadow-lg outline-none">{children}</PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 py-1.5">
      <span>{label}</span><Switch checked={checked} onCheckedChange={(v) => onChange(v === true)} aria-label={label} />
    </label>
  );
}

type Props = {
  vatOn: boolean; onVat: (on: boolean) => void; opts: EditorOptions; setOpts: (o: EditorOptions) => void;
  print: PrintSettings; setPrint: (p: PrintSettings) => void; isReceipt: boolean;
};

/** Thanh công cụ góc phải màn nhập hàng (ảnh 288): VAT theo dòng / nhập tay, cài đặt in, tùy chọn hiển thị, phím tắt. */
export function PurchaseEditorToolbar({ vatOn, onVat, opts, setOpts, print, setPrint, isReceipt }: Props) {
  const t = useT(purchasesNs);
  const [tab, setTab] = useState<"show" | "other">("show");
  const toggleCol = (c: EditorColumn, on: boolean) => setOpts({ ...opts, hidden: on ? opts.hidden.filter((x) => x !== c) : [...opts.hidden, c] });
  const keys: [string, string][] = [["F3", "kv.keys.f3"], ["F4", "kv.keys.f4"], ["F8", isReceipt ? "kv.keys.f8" : "kv.keys.f8Return"],
    ["F9", "kv.keys.f9"], ["↑", "kv.keys.up"], ["↓", "kv.keys.down"], ["Enter", "kv.keys.enter"], ["Shift", "kv.keys.shift"]];
  return (
    <div className="ml-auto flex items-center gap-1.5">
      <button type="button" aria-pressed={vatOn} title={t(vatOn ? "kv.vatLineOn" : "kv.vatLineOff")} aria-label={t("kv.vatToggle")}
        onClick={() => onVat(!vatOn)} className={cn(ICON_BTN, vatOn && "border-primary bg-primary text-primary-foreground hover:bg-primary/90")}>
        <FileText className="size-3.5" /><span className="sr-only">VAT</span>
      </button>
      <ToolPopover label={t("kv.printSettings")} icon={<Printer className="size-3.5" />} width={260}>
        <Toggle label={t("kv.autoPrint")} checked={print.auto} onChange={(auto) => setPrint({ ...print, auto })} />
        <div className="flex items-center justify-between py-1.5">
          <span>{t("kv.copies")}</span>
          <div className="flex items-center gap-1">
            <button type="button" className={ICON_BTN} aria-label="−" onClick={() => setPrint({ ...print, copies: Math.max(1, print.copies - 1) })}>−</button>
            <span className="w-8 text-center">{print.copies}</span>
            <button type="button" className={ICON_BTN} aria-label="+" onClick={() => setPrint({ ...print, copies: Math.min(5, print.copies + 1) })}>+</button>
          </div>
        </div>
      </ToolPopover>
      <ToolPopover label={t("kv.displayOptions")} icon={<Eye className="size-3.5" />} width={260}>
        <div className="mb-2 font-bold">{t("kv.displayOptions")}</div>
        <div className="mb-2 flex gap-4 border-b">
          {(["show", "other"] as const).map((x) => (
            <button key={x} type="button" onClick={() => setTab(x)}
              className={cn("pb-1.5", tab === x ? "border-b-2 border-primary text-primary" : "text-muted-foreground")}>{t(`kv.tab.${x}`)}</button>
          ))}
        </div>
        {tab === "show" ? EDITOR_COLUMNS.filter((c) => isReceipt || c !== "discount").map((c) => (
          <Toggle key={c} label={t(`kv.col.${c}`)} checked={!opts.hidden.includes(c)} onChange={(on) => toggleCol(c, on)} />
        )) : <>
          {isReceipt && <Toggle label={t("kv.priceSetup")} checked={opts.priceSetup} onChange={(priceSetup) => setOpts({ ...opts, priceSetup })} />}
          <Toggle label={t("kv.editAmount")} checked={opts.editAmount} onChange={(editAmount) => setOpts({ ...opts, editAmount })} />
          {isReceipt && (
            <div className="flex items-center justify-between py-1.5">
              <span>{t("lines.discount")}</span>
              <div className="flex overflow-hidden rounded-md border text-xs">
                {[false, true].map((pct) => (
                  <button key={String(pct)} type="button" onClick={() => setOpts({ ...opts, discountPercent: pct })}
                    className={cn("px-2 py-0.5", opts.discountPercent === pct && "bg-primary text-primary-foreground")}>{pct ? "%" : "VND"}</button>
                ))}
              </div>
            </div>
          )}
          <Toggle label={t(isReceipt ? "kv.defaultPayAll" : "kv.defaultRefundAll")} checked={opts.defaultPayAll}
            onChange={(defaultPayAll) => setOpts({ ...opts, defaultPayAll })} />
        </>}
      </ToolPopover>
      <ToolPopover label={t("kv.shortcuts")} icon={<span className="text-[13px] font-bold text-primary">!</span>} width={300}>
        <div className="mb-2 font-bold">{t("kv.shortcuts")}</div>
        <dl className="grid grid-cols-[64px_1fr] gap-y-1.5">
          {keys.map(([k, l]) => <div key={k} className="contents"><dt className="font-semibold">{k}:</dt><dd>{t(l)}</dd></div>)}
        </dl>
      </ToolPopover>
      <SlidersHorizontal className="hidden" aria-hidden />
    </div>
  );
}
