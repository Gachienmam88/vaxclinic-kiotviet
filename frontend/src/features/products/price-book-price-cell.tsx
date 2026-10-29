"use client";

import { useMemo, useRef, useState } from "react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { toast } from "sonner";
import { errorMessage } from "@/lib/api-client";
import { formatMoney, parseNumber } from "@/lib/format";
import { renderRichText } from "@/lib/i18n/render-rich-text";
import { cn } from "@/lib/utils";
import { zoomAwarePositioning } from "@/lib/zoom-aware-floating-anchor";
import { useSetPrices } from "./price-book-queries";
import { BASE_BOOK_ID } from "./price-book-types";
import { useT } from "@/lib/i18n";
import { productsNs } from "@/messages/products";

type Props = {
  /** Bảng giá của ô; BASE_BOOK_ID = Bảng giá chung (giá chung, không bỏ trống được). */
  bookId: string;
  unitId: string;
  price: number | undefined;
  basePrice: number;
  editable: boolean;
  /** Bấm "Công thức" trong gợi ý khi đang sửa ô → mở "Đặt giá theo công thức" neo tại ô. */
  onFormula: (anchor: HTMLElement) => void;
};

/**
 * Ô giá kiểu KiotViet. Enter (hoặc rời ô) = lưu; Esc = hủy. Đang sửa → gợi ý "Hoặc sử dụng Công thức".
 * Bảng giá: xóa trống + Enter = bỏ hàng khỏi bảng giá; chưa có trong bảng thì hiện giá chung mờ làm gợi ý.
 */
export function PriceBookPriceCell({ bookId, unitId, price, basePrice, editable, onFormula }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  /** Bấm "Công thức" → rời ô không lưu bản nháp. */
  const skipCommit = useRef(false);
  const setPrices = useSetPrices();
  const t = useT(productsNs);
  const isBase = bookId === BASE_BOOK_ID;
  const shown = price == null ? "" : formatMoney(price);
  const editing = draft != null;
  const positioning = useMemo(() => (editing ? zoomAwarePositioning(() => input.current) : undefined), [editing]);

  function commit() {
    if (draft == null) return;
    if (skipCommit.current) { skipCommit.current = false; setDraft(null); return; }
    const text = draft.trim();
    setDraft(null);
    if (text === shown) return;
    if (text && !/^[\d,]+(\.\d+)?$/.test(text)) return toast.error(t("priceBooks.invalidPrice"));
    if (!text && isBase) return toast.error(t("priceBooks.baseNotEmpty"));
    if (!text && price == null) return;
    setPrices.mutate({ bookId, items: [{ unitId, price: text ? parseNumber(text) : null }] }, {
      onError: (e) => toast.error(errorMessage(e)),
    });
  }

  if (!editable) {
    return <span className={cn(price == null && "text-muted-foreground")}>{price == null ? "—" : shown}</span>;
  }
  return (
    <PopoverPrimitive.Root open={editing}>
      <input ref={input} aria-label={t("priceBooks.priceCellAria")} inputMode="numeric" value={draft ?? shown}
        placeholder={isBase ? "" : formatMoney(basePrice)} disabled={setPrices.isPending}
        onFocus={(e) => { setDraft(shown); e.currentTarget.select(); }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") { setDraft(null); requestAnimationFrame(() => (e.target as HTMLInputElement).blur()); }
        }}
        className="h-[26px] w-[90px] rounded border border-[#c9ccd1] bg-background px-1.5 text-right outline-none placeholder:text-muted-foreground/60 focus:border-primary" />
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner className="isolate z-40 outline-none" {...positioning} side="bottom" align="end" sideOffset={6}>
          <PopoverPrimitive.Popup initialFocus={false} finalFocus={false}
            className="rounded-lg border bg-popover px-3 py-2.5 text-[13px] whitespace-nowrap text-popover-foreground shadow-md outline-none">
            {renderRichText(t("formulaPopover.hint"), {
              link: (
                <button type="button" className="text-primary hover:underline"
                  // Giữ focus ở ô giá để gợi ý không đóng trước khi bấm.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { const el = input.current; if (el) { skipCommit.current = true; el.blur(); onFormula(el); } }}>
                  {t("formulaPopover.hintLink")}
                </button>
              ),
            })}
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
