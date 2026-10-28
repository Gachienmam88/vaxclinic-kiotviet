"use client";

import { useState } from "react";
import { toast } from "sonner";
import { errorMessage } from "@/lib/api-client";
import { formatMoney, parseNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useSetPrices } from "./price-book-queries";

type Props = { bookId: string; unitId: string; price: number | undefined; basePrice: number; editable: boolean };

/**
 * Ô giá trong 1 bảng giá. Enter (hoặc rời ô) = lưu; Esc = hủy. Xóa trống + Enter = bỏ hàng khỏi bảng giá.
 * Chưa có trong bảng: hiện giá chung mờ làm gợi ý.
 */
export function PriceBookPriceCell({ bookId, unitId, price, basePrice, editable }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const setPrices = useSetPrices();
  const shown = price == null ? "" : formatMoney(price);

  function commit() {
    if (draft == null) return;
    const text = draft.trim();
    setDraft(null);
    if (text === shown) return;
    if (text && !/^[\d,]+(\.\d+)?$/.test(text)) return toast.error("Giá không hợp lệ");
    if (!text && price == null) return;
    setPrices.mutate({ bookId, items: [{ unitId, price: text ? parseNumber(text) : null }] }, {
      onError: (e) => toast.error(errorMessage(e)),
    });
  }

  if (!editable) {
    return <span className={cn(price == null && "text-muted-foreground")}>{price == null ? "—" : shown}</span>;
  }
  return (
    <input aria-label="Giá trong bảng giá" inputMode="numeric" value={draft ?? shown} placeholder={formatMoney(basePrice)}
      disabled={setPrices.isPending}
      onFocus={(e) => { setDraft(shown); e.currentTarget.select(); }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") { setDraft(null); requestAnimationFrame(() => (e.target as HTMLInputElement).blur()); }
      }}
      className="h-7 w-28 rounded border border-transparent bg-transparent px-1.5 text-right outline-none placeholder:text-muted-foreground/60 hover:border-[#d1d5db] focus:border-primary focus:bg-background" />
  );
}
