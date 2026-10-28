"use client";

import { useState } from "react";
import { formatMoney, formatNumber } from "@/lib/format";
import { normalize } from "./use-sale-catalog";
import type { CatalogProduct } from "./sale-types";

/** Chế độ Bán thường: lưới hàng hóa để bấm chọn (màn cảm ứng), lọc nhanh theo tên. */
export function SaleProductGrid({ products, onPick }: { products: CatalogProduct[]; onPick: (p: CatalogProduct, unitId: string) => void }) {
  const [filter, setFilter] = useState("");
  const q = normalize(filter);
  const shown = (q ? products.filter((p) => normalize(p.name).includes(q)) : products).slice(0, 60);
  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-lg bg-background p-3 shadow-[0_1px_2px_rgba(0,0,0,0.08)]">
      <input className="mb-2 h-8 rounded-md border px-2 text-[13px] outline-none focus:border-primary" placeholder="Lọc hàng hóa theo tên"
        value={filter} onChange={(e) => setFilter(e.target.value)} />
      <div className="grid grid-cols-2 gap-2 overflow-y-auto md:grid-cols-4 xl:grid-cols-5">
        {shown.map((p) => {
          const u = p.units[0];
          return (
            <button key={p.id} type="button" onClick={() => onPick(p, u.id)}
              className="flex flex-col items-start rounded-md border p-2 text-left text-[13px] hover:border-primary hover:bg-primary/5">
              <span className="line-clamp-2 font-medium">{p.name}</span>
              <span className="mt-auto pt-1 font-semibold text-primary">{formatMoney(u.price)}</span>
              <span className={`text-xs ${p.stock <= 0 ? "text-destructive" : "text-muted-foreground"}`}>Tồn {formatNumber(p.stock)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
