"use client";

import { useEffect, useState } from "react";
import { ImageIcon, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { ProductFormDialog } from "@/features/products/product-form-dialog";
import { EMPTY_FILTERS, useProducts } from "@/features/products/product-queries";
import type { ProductDetail } from "@/features/products/product-types";
import { api, errorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { inputInvoicesNs } from "@/messages/input-invoices";

/** Hàng đã chọn cho 1 dòng hóa đơn (đủ đơn vị để chọn ĐVT). */
export type PickedProduct = { id: string; name: string; units: { id: string; code: string; unitName: string; base: boolean }[] };

export const toPicked = (p: ProductDetail): PickedProduct => ({
  id: p.id, name: p.name, units: p.units.map((u) => ({ id: u.id, code: u.code, unitName: u.unitName, base: u.base })),
});

function Thumb() {
  return <span className="flex size-8 shrink-0 items-center justify-center rounded bg-primary-tint text-primary"><ImageIcon className="size-4" /></span>;
}

/**
 * Ô "Hàng hóa trên hệ thống": tìm theo tên (không dấu, chứa) hoặc mã / mã vạch (chứa) — cùng API danh sách hàng hóa.
 * Đã chọn → tên, ĐVT (màu chính), mã + nút ×. Cuối danh sách "+ Thêm mới" mở form tạo hàng hóa.
 */
export function InputInvoiceProductPicker({ value, unitId, invalid, onPick, onClear }: {
  value: PickedProduct | null; unitId: string; invalid?: boolean; onPick: (p: PickedProduct) => void; onClear: () => void;
}) {
  const t = useT(inputInvoicesNs);
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  useEffect(() => { const h = setTimeout(() => setQ(text), 250); return () => clearTimeout(h); }, [text]);
  const { data } = useProducts({ ...EMPTY_FILTERS, q }, 0, 10);

  async function pick(id: string) {
    try {
      onPick(toPicked(await api<ProductDetail>(`/products/${id}`)));
      setText("");
      setOpen(false);
    } catch (e) { toast.error(errorMessage(e)); }
  }

  if (value) {
    const unit = value.units.find((u) => u.id === unitId) ?? value.units[0];
    return (
      <div className="flex min-w-[220px] items-start gap-2">
        <Thumb />
        <div className="min-w-0 flex-1 text-[13px] leading-tight">
          <div>{value.name} <span className="text-primary">{unit?.unitName}</span></div>
          <div className="text-xs text-primary/80">{unit?.code}</div>
        </div>
        <button type="button" className="text-destructive" aria-label={t("confirm.clearProduct")} onClick={onClear}><X className="size-3.5" /></button>
      </div>
    );
  }
  return (
    <div className="relative min-w-[220px]">
      <Search className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input aria-label={t("confirm.searchProduct")} placeholder={t("confirm.searchProduct")} value={text}
        className={cn("h-8 w-full rounded-md border bg-background pr-2 pl-7 text-[13px] outline-none focus-visible:border-primary",
          invalid && "border-destructive")}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => { setText(e.target.value); setOpen(true); }}
        onKeyDown={(e) => { if (e.key === "Enter" && data?.items[0]) pick(data.items[0].id); }} />
      {open && (
        <div className="absolute z-50 mt-1 w-[300px] rounded-md border bg-popover shadow-lg">
          <div className="max-h-64 overflow-y-auto">
            {q && !data?.items.length && <div className="p-3 text-[13px] text-muted-foreground">{t("confirm.noProduct")}</div>}
            {data?.items.map((p) => (
              <button key={p.id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(p.id)}
                className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-muted">
                <Thumb />
                <span className="min-w-0 text-[13px] leading-tight"><b>{p.name}</b> <span className="text-primary">{p.unitName}</span>
                  <span className="block text-xs text-muted-foreground">{p.code}</span></span>
              </button>
            ))}
          </div>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { setOpen(false); setCreating(true); }}
            className="flex w-full items-center gap-1 border-t px-3 py-2 text-[13px] text-primary hover:bg-muted">
            <Plus className="size-3.5" /> {t("confirm.addProduct")}</button>
        </div>
      )}
      {creating && <ProductFormDialog onClose={() => setCreating(false)} />}
    </div>
  );
}
