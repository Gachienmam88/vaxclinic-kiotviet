"use client";

import { useMemo, useState } from "react";
import { ListChecks, ScanLine, Search } from "lucide-react";
import { formatMoney, formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { saleNs } from "@/messages/sale";
import { normalize, searchCatalog } from "./use-sale-catalog";
import { useSaleSettings } from "./use-sale-settings";
import type { CatalogProduct } from "./sale-types";

type Props = { products: CatalogProduct[]; onPick: (p: CatalogProduct, unitId: string) => void };
type Hit = { product: CatalogProduct; unitId: string };

const exactIndex = (results: Hit[], q: string) =>
  results.findIndex((r) => r.product.units.some((u) => normalize(u.code) === q || (u.barcode && normalize(u.barcode) === q)));

/**
 * Ô "Tìm hàng hóa (F3)" (id sale-product-search) + nút chọn nhiều hàng + nút quét mã. Tìm trên danh mục lưu ở máy (chạy cả khi
 * mất mạng). Máy quét gõ mã + Enter: khớp đúng mã → thêm thẳng. "Quét mã để thêm hàng hóa nhanh": khớp đúng 1 mã là thêm
 * ngay, không cần Enter. "Chế độ chọn nhiều hàng hóa": tích nhiều dòng rồi bấm Thêm (hoặc Enter).
 */
export function SaleProductSearch({ products, onPick }: Props) {
  const { settings: s, set } = useSaleSettings();
  const t = useT(saleNs);
  const onOff = (on: boolean) => t(on ? "search.on" : "search.off");
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const results = useMemo(() => searchCatalog(products, text), [products, text]);
  const idOf = (r: Hit) => r.product.id + r.unitId;

  const reset = () => { setText(""); setCursor(0); setChecked(new Set()); };
  const pick = (r: Hit | undefined) => { if (r) { onPick(r.product, r.unitId); reset(); } };
  const addChecked = () => { results.filter((r) => checked.has(idOf(r))).forEach((r) => onPick(r.product, r.unitId)); reset(); };

  function onChange(v: string) {
    setText(v); setOpen(true); setCursor(0);
    if (!s.scanQuickAdd || s.multiSelect) return;
    const q = normalize(v);
    const hits = searchCatalog(products, v);
    const i = exactIndex(hits, q);
    // Chỉ thêm ngay khi mã không phải phần đầu của mã khác (tránh thêm nhầm khi đang gõ dở)
    const prefixOfOther = products.some((p) => p.units.some((u) => normalize(u.code) !== q && normalize(u.code).startsWith(q)));
    if (i >= 0 && !prefixOfOther) pick(hits[i]);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, results.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    if (e.key === " " && s.multiSelect && results[cursor]) { e.preventDefault(); toggle(idOf(results[cursor])); }
    if (e.key === "Enter") {
      e.preventDefault();
      if (s.multiSelect && checked.size) return addChecked();
      const i = exactIndex(results, normalize(text));
      pick(results[i >= 0 ? i : cursor]);
    }
    if (e.key === "Escape") setOpen(false);
  }

  const toggle = (id: string) => setChecked((c) => { const n = new Set(c); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const iconBtn = (on: boolean) => `grid size-8 shrink-0 place-items-center rounded-md ${on ? "bg-white/25 text-white" : "text-white/80 hover:bg-white/10"}`;

  return (
    <div className="flex shrink-0 items-center gap-1">
      <div className="relative w-[330px]">
        <Search className="absolute top-2 left-2.5 size-4 text-[#6b7280]" />
        <input id="sale-product-search" autoFocus value={text} placeholder={t("search.placeholder")} aria-label={t("search.placeholder")}
          className="h-8 w-full rounded-md bg-background pr-9 pl-8 text-[13px] text-foreground outline-none placeholder:text-[#6b7280]"
          onChange={(e) => onChange(e.target.value)} onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)} onKeyDown={onKeyDown} />
        <button type="button" aria-pressed={s.multiSelect} title={`${t("search.multiSelect")}: ${onOff(s.multiSelect)}`}
          aria-label={t("search.multiSelect")} onClick={() => set({ multiSelect: !s.multiSelect })}
          className={`absolute top-1 right-1 grid size-6 place-items-center rounded ${s.multiSelect ? "bg-primary/15 text-primary" : "text-[#4b5563] hover:text-primary"}`}>
          <ListChecks className="size-4" /></button>
        {open && text && (
          <div className="absolute z-50 mt-1 max-h-[26rem] w-[34rem] overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-lg">
            {!results.length && <div className="p-3 text-sm text-muted-foreground">{t("search.noResults")}</div>}
            {results.map((r, i) => {
              const unit = r.product.units.find((u) => u.id === r.unitId)!;
              const id = idOf(r);
              return (
                <button key={id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => (s.multiSelect ? toggle(id) : pick(r))}
                  className={`flex w-full items-start gap-3 border-b border-[#f0f1f3] px-3 py-2 text-left text-[13px] ${i === cursor ? "bg-primary/10" : "hover:bg-muted"}`}>
                  {s.multiSelect && <input type="checkbox" readOnly tabIndex={-1} checked={checked.has(id)} className="mt-1 size-4 accent-primary" />}
                  <span className="flex-1"><span className="font-medium">{r.product.name}</span>
                    <span className="block text-xs text-muted-foreground">{unit.code} · {unit.unitName}</span></span>
                  <span className="shrink-0 text-right text-xs">
                    <span className="font-semibold text-primary">{formatMoney(unit.price)}</span><br />
                    {t("line.stock", { qty: formatNumber(r.product.stock / unit.conversionRate) })}
                  </span>
                </button>
              );
            })}
            {s.multiSelect && results.length > 0 && (
              <div className="sticky bottom-0 flex items-center justify-between bg-popover px-3 py-2 text-[13px] shadow-[0_-1px_0_#eef0f3]">
                <span>{t("search.selected", { count: checked.size })}</span>
                <button type="button" disabled={!checked.size} onMouseDown={(e) => e.preventDefault()} onClick={addChecked}
                  className="h-7 rounded-md bg-primary px-3 font-semibold text-white disabled:opacity-50">{t("search.addToOrder")}</button>
              </div>
            )}
          </div>
        )}
      </div>
      <button type="button" aria-pressed={s.scanQuickAdd} aria-label={t("search.scanQuickAdd")}
        title={`${t("search.scanQuickAdd")}: ${onOff(s.scanQuickAdd)}`}
        className={iconBtn(s.scanQuickAdd)} onClick={() => set({ scanQuickAdd: !s.scanQuickAdd })}><ScanLine className="size-5" /></button>
    </div>
  );
}
