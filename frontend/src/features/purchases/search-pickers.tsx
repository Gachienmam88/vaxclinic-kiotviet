"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { api, errorMessage } from "@/lib/api-client";
import { formatMoney, formatNumber } from "@/lib/format";
import { useProducts, EMPTY_FILTERS } from "@/features/products/product-queries";
import type { ProductDetail } from "@/features/products/product-types";
import { useSuppliers } from "./purchase-queries";
import type { Supplier } from "./purchase-types";

function useDebounced(value: string, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

/** Ô "Tìm hàng hóa theo mã hoặc tên (F3)". Chọn 1 hàng → trả về chi tiết đầy đủ (đơn vị, lô, giá vốn). */
export function ProductPicker({ onPick }: { onPick: (p: ProductDetail) => void }) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const q = useDebounced(text);
  const { data } = useProducts({ ...EMPTY_FILTERS, q }, 0, 10);

  // F3 = focus ô tìm hàng (phím tắt quen thuộc của màn nhập/bán hàng)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "F3") { e.preventDefault(); ref.current?.focus(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function pick(id: string) {
    try {
      onPick(await api<ProductDetail>(`/products/${id}`));
      setText("");
      setOpen(false);
    } catch (e) { toast.error(errorMessage(e)); }
  }

  return (
    <div className="relative w-full max-w-[400px]">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input ref={ref} aria-label="Tìm hàng hóa" className="h-8 rounded-md border-primary bg-background pl-8" placeholder="Tìm hàng hóa theo mã hoặc tên (F3)" value={text}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => { setText(e.target.value); setOpen(true); }}
        onKeyDown={(e) => { if (e.key === "Enter" && data?.items[0]) pick(data.items[0].id); }} />
      {open && q && (
        <div className="absolute z-50 mt-1 max-h-80 w-[36rem] overflow-y-auto rounded-md border bg-popover shadow-lg">
          {!data?.items.length && <div className="p-3 text-sm text-muted-foreground">Không tìm thấy hàng hóa</div>}
          {data?.items.map((p) => (
            <button key={p.id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(p.id)}
              className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted">
              <span><span className="font-medium">{p.name}</span>
                <span className="block text-xs text-muted-foreground">{p.code} · {p.unitName}{p.lotManaged && " · theo lô"}</span></span>
              <span className="shrink-0 text-right text-xs">Giá vốn {formatNumber(p.cost)}<br />Tồn {formatNumber(p.stock)} · Bán {formatMoney(p.price)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Ô "Tìm nhà cung cấp" + nút thêm nhanh. */
export function SupplierPicker({ value, onChange, onCreate, disabled }: {
  value: { id: string; name: string } | null;
  onChange: (s: Supplier | null) => void;
  onCreate: () => void;
  disabled?: boolean;
}) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const q = useDebounced(text);
  const { data } = useSuppliers(q, 0, 8);

  if (value) {
    return (
      <div className="flex h-[30px] items-center justify-between rounded-md border border-[#d1d5db] bg-[#f7f8fa] px-2 text-[13px]">
        <span className="truncate font-medium text-primary">{value.name}</span>
        {!disabled && <button type="button" className="text-muted-foreground" onClick={() => onChange(null)} aria-label="Bỏ chọn">×</button>}
      </div>
    );
  }
  return (
    <div className="relative">
      <Input placeholder="Tìm nhà cung cấp" aria-label="Tìm nhà cung cấp" value={text} disabled={disabled}
        className="h-[30px] rounded-md border-[#d1d5db] pr-8"
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => { setText(e.target.value); setOpen(true); }} />
      <button type="button" className="absolute top-1/2 right-2 -translate-y-1/2 text-foreground hover:text-primary" onClick={onCreate} aria-label="Thêm nhà cung cấp">
        <Plus className="size-4" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-md border bg-popover shadow-lg">
          {!data?.items.length && <div className="p-3 text-sm text-muted-foreground">Không có nhà cung cấp phù hợp</div>}
          {data?.items.map((s) => (
            <button key={s.id} type="button" onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange(s); setText(""); setOpen(false); }}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-muted">
              <span className="font-medium">{s.name}</span>
              <span className="block text-xs text-muted-foreground">{s.code}{s.phone && ` · ${s.phone}`}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
