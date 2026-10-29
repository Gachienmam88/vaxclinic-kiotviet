"use client";

import { useMemo, useRef, useState } from "react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { X } from "lucide-react";
import { zoomAwarePositioning } from "@/lib/zoom-aware-floating-anchor";
import { useT } from "@/lib/i18n";
import { productsNs } from "@/messages/products";

export type ChipOption = { id: string; name: string; note?: string };

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase();

/**
 * Ô chọn nhiều bảng giá dạng chip (KiotViet "Bảng giá"): chip tím có nút ×, gõ để lọc, bấm vào ô để mở danh sách
 * các bảng giá chưa chọn. Thứ tự chip = thứ tự cột giá trên bảng.
 */
export function PriceBookChipSelect({ options, value, onChange }: {
  options: ChipOption[]; value: string[]; onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const t = useT(productsNs);
  const chips = value.map((id) => options.find((o) => o.id === id)).filter((o): o is ChipOption => !!o);
  const rest = options.filter((o) => !value.includes(o.id) && (!query.trim() || fold(o.name).includes(fold(query.trim()))));
  const positioning = useMemo(() => (open ? zoomAwarePositioning(() => box.current) : undefined), [open]);

  function pick(id: string) {
    onChange([...value, id]);
    setQuery("");
    input.current?.focus();
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <div ref={box} className="flex min-h-8 w-full flex-wrap items-center gap-1 rounded-md border border-input bg-background px-1 py-[3px] focus-within:border-primary"
        onClick={() => { setOpen(true); input.current?.focus(); }}>
        {chips.map((c) => (
          <span key={c.id} className="inline-flex max-w-full items-center gap-1 rounded bg-primary px-1.5 py-0.5 text-[13px] font-medium text-primary-foreground">
            <span className="truncate" title={c.name}>{c.name}</span>
            <button type="button" aria-label={t("priceBooks.removeChip", { name: c.name })} className="shrink-0 opacity-90 hover:opacity-100"
              onClick={(e) => { e.stopPropagation(); onChange(value.filter((x) => x !== c.id)); }}>
              <X className="size-3.5" />
            </button>
          </span>
        ))}
        <input ref={input} aria-label={t("priceBooks.pickBooks")} value={query} placeholder={chips.length ? "" : t("priceBooks.pickBooks")}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !query && value.length) onChange(value.slice(0, -1));
            if (e.key === "Enter" && rest[0]) { e.preventDefault(); pick(rest[0].id); }
          }}
          className="h-6 min-w-12 flex-1 bg-transparent px-1 text-[13px] outline-none placeholder:text-muted-foreground" />
      </div>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner className="isolate z-50 outline-none" {...positioning} side="bottom" align="start" sideOffset={4}>
          <PopoverPrimitive.Popup initialFocus={false} finalFocus={false}
            className="max-h-72 w-[var(--anchor-width)] min-w-48 overflow-y-auto rounded-md border bg-popover py-1 text-[13px] text-popover-foreground shadow-lg outline-none">
            {!rest.length && <div className="px-3 py-1.5 text-muted-foreground">{t("priceBooks.noMoreBooks")}</div>}
            {rest.map((o) => (
              <button key={o.id} type="button" onClick={() => pick(o.id)}
                className="block w-full px-3 py-1.5 text-left hover:bg-muted">
                {o.name}{o.note && <span className="ml-1 text-xs text-muted-foreground">({o.note})</span>}
              </button>
            ))}
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
