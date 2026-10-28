"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { formatMoney, formatNumber } from "@/lib/format";
import { normalize, searchCatalog } from "./use-pos-catalog";
import type { CatalogProduct } from "./pos-types";

type Props = { products: CatalogProduct[]; onPick: (p: CatalogProduct, unitId: string) => void };

/**
 * Ô "Tìm hàng hóa (F3)". Máy quét mã vạch gõ mã + Enter: khớp đúng mã → thêm thẳng vào giỏ.
 * Tìm trên danh mục đã lưu ở máy nên chạy cả khi mất mạng.
 */
export function PosProductSearch({ products, onPick }: Props) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const ref = useRef<HTMLInputElement>(null);
  const results = useMemo(() => searchCatalog(products, text), [products, text]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "F3") { e.preventDefault(); ref.current?.focus(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function pick(i: number) {
    const r = results[i];
    if (!r) return;
    onPick(r.product, r.unitId);
    setText("");
    setCursor(0);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, results.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    if (e.key === "Enter") {
      e.preventDefault();
      // Quét mã: ưu tiên dòng có mã/mã vạch trùng khớp tuyệt đối
      const q = normalize(text);
      const exact = results.findIndex((r) => r.product.units.some((u) => normalize(u.code) === q || (u.barcode && normalize(u.barcode) === q)));
      pick(exact >= 0 ? exact : cursor);
    }
    if (e.key === "Escape") setOpen(false);
  }

  return (
    <div className="relative w-full max-w-sm">
      <Search className="absolute top-2 left-2.5 size-4 text-muted-foreground" />
      <input ref={ref} autoFocus value={text} placeholder="Tìm hàng hóa (F3)"
        className="h-8 w-full rounded-md bg-background pr-2 pl-8 text-sm text-foreground outline-none"
        onChange={(e) => { setText(e.target.value); setOpen(true); setCursor(0); }}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} onKeyDown={onKeyDown} />
      {open && text && (
        <div className="absolute z-50 mt-1 max-h-96 w-[34rem] overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-lg">
          {!results.length && <div className="p-3 text-sm text-muted-foreground">Không tìm thấy hàng hóa</div>}
          {results.map((r, i) => {
            const unit = r.product.units.find((u) => u.id === r.unitId)!;
            return (
              <button key={r.product.id + unit.id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(i)}
                className={`flex w-full items-start justify-between gap-3 px-3 py-2 text-left text-sm ${i === cursor ? "bg-primary/10" : "hover:bg-muted"}`}>
                <span><span className="font-medium">{r.product.name}</span>
                  <span className="block text-xs text-muted-foreground">{unit.code} · {unit.unitName}</span></span>
                <span className="shrink-0 text-right text-xs">
                  <span className="font-semibold text-primary">{formatMoney(unit.price)}</span><br />
                  Tồn: {formatNumber(r.product.stock / unit.conversionRate)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
