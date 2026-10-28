"use client";

import { useState } from "react";
import { BadgePercent, EllipsisVertical, HandCoins, Info, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { NumberInput } from "@/components/number-input";
import { DocCodeLink } from "@/components/ui/doc-code-link";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { PriceResolution } from "@/features/products/price-book-resolver";
import { formatMoney, formatNumber } from "@/lib/format";
import { underlineInput } from "./sale-ui-parts";
import type { SaleSettings } from "./sale-settings";
import type { CartLine, CatalogUnit } from "./sale-types";

/** Cột của tab trả hàng theo hóa đơn: STT · (trống) · mã · tên · đơn vị · SL · đơn giá · thành tiền · (trống). */
export const CART_GRID = "grid grid-cols-[24px_28px_112px_minmax(0,1fr)_72px_100px_104px_112px_32px] items-center gap-x-2";

/** Cột giỏ hàng theo Thiết lập & Hiển thị (Số thứ tự, Mã hàng, Giá bán, Thành tiền, Thêm dòng). */
export function cartColumns(s: SaleSettings) {
  return [s.showIndex && "24px", "28px", s.showCode && "112px", "minmax(0,1fr)", "72px", "100px", s.showPrice && "104px",
    s.showAmount && "112px", s.addLine && "24px", "32px"].filter(Boolean).join(" ");
}

type Props = {
  line: CartLine; index: number; settings: SaleSettings; selected: boolean; stock: number | null; lastPrice: number | null;
  update: (patch: Partial<CartLine>) => void; onRemove: () => void; onAddLine: () => void; onSelect: () => void;
  onRecentPrice: () => void; onDetail: () => void; resolveUnit: (u: CatalogUnit) => PriceResolution; extra?: React.ReactNode;
  drag?: React.HTMLAttributes<HTMLDivElement>;
};

/**
 * 1 dòng hàng: thẻ trắng bo 8px; ⋮ → Xem giá bán gần nhất / Giảm giá / Ghi chú / Xem chi tiết; (+) thêm dòng cùng hàng.
 * Sửa đơn giá (hoặc thành tiền khi bật "Chỉnh sửa thành tiền") → priceEdited; đổi đơn vị → lấy lại giá theo bảng giá.
 */
export function SaleCartLine({ line: l, index, settings: s, selected, stock, lastPrice, update, onRemove, onAddLine, onSelect,
  onRecentPrice, onDetail, resolveUnit, extra, drag }: Props) {
  const [showDiscount, setShowDiscount] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [percent, setPercent] = useState(s.discountType === "PERCENT");
  const unit = l.units.find((u) => u.id === l.unitId) ?? l.units[0];
  const amount = Math.round(l.quantity * (l.unitPrice - l.discount));
  const badge = "max-w-full truncate rounded bg-primary-tint px-1.5 py-0.5 text-[13px] text-primary";
  const item = "gap-3 py-2 text-[13px] [&_svg]:size-4";
  const pct = l.unitPrice > 0 ? Math.round((l.discount / l.unitPrice) * 10000) / 100 : 0;

  return (
    <div {...drag} onClick={onSelect} data-line-key={l.key}
      className={`group rounded-lg bg-background px-3 shadow-[0_1px_2px_rgba(0,0,0,0.08)] hover:shadow-[0_1px_4px_rgba(0,0,0,0.16)] ${selected ? "ring-1 ring-primary/60" : ""}`}>
      <div className="grid min-h-11 items-center gap-x-2 text-[13px]" style={{ gridTemplateColumns: cartColumns(s) }}>
        {s.showIndex && <span className="text-center">{index}</span>}
        <button type="button" aria-label="Xóa dòng" className="grid place-items-center text-[#4b5563] hover:text-destructive" onClick={onRemove}>
          <Trash2 className="size-4" /></button>
        {s.showCode && <span className="truncate" title={unit.code}><DocCodeLink code={unit.code} kind="/products" newTab /></span>}
        <div className="min-w-0 py-1">
          <span className="block truncate" title={l.productName}>{l.productName}</span>
          {(s.showStock && stock != null) || (s.showLastPrice && lastPrice != null) ? (
            <span className="flex gap-3 text-xs text-[#6b7280]">
              {s.showStock && stock != null && <span>Tồn: {formatNumber(stock)}</span>}
              {s.showLastPrice && lastPrice != null && <button type="button" title="Áp dụng giá bán gần nhất của khách"
                className="hover:text-primary" onClick={() => update({ unitPrice: lastPrice, discount: 0, priceEdited: true })}>
                Giá gần nhất: {formatMoney(lastPrice)}</button>}
            </span>) : null}
          {extra}
        </div>
        <span>
          {l.units.length > 1 ? (
            <select aria-label="Đơn vị tính" className={`${badge} appearance-none outline-none`} value={l.unitId}
              onChange={(e) => {
                const u = l.units.find((x) => x.id === e.target.value)!;
                const r = resolveUnit(u);
                if (!r.allowed) { toast.warning(`${l.productName} (${u.unitName}): ${r.warning}`); return; }
                if (r.warning) toast.warning(`${l.productName} (${u.unitName}): ${r.warning}`);
                update({ unitId: u.id, unitPrice: r.price, discount: 0, priceEdited: false });
              }}>
              {l.units.map((u) => <option key={u.id} value={u.id}>{u.unitName}</option>)}
            </select>
          ) : <span className={badge}>{unit.unitName}</span>}
        </span>
        <NumberInput aria-label="Số lượng" id={`sale-qty-${l.key}`} data-sale-qty="" className={`${underlineInput} text-center`} value={l.quantity}
          onFocus={onSelect} onValueChange={(quantity) => update({ quantity: Math.max(quantity, 0) })} />
        {s.showPrice && <NumberInput aria-label="Đơn giá" className={underlineInput} value={l.unitPrice}
          onValueChange={(unitPrice) => update({ unitPrice, discount: Math.min(l.discount, unitPrice), priceEdited: true })} />}
        {s.showAmount && (s.editAmount
          ? <NumberInput aria-label="Thành tiền" className={`${underlineInput} font-bold`} value={amount}
              onValueChange={(v) => l.quantity > 0 && update({ unitPrice: Math.round(v / l.quantity) + l.discount, priceEdited: true })} />
          : <span className="text-right font-bold">{formatMoney(amount)}</span>)}
        {s.addLine && <button type="button" aria-label="Thêm dòng" title="Thêm dòng cùng hàng" className="grid place-items-center text-[#1f2329] hover:text-primary"
          onClick={onAddLine}><Plus className="size-4" /></button>}
        <DropdownMenu>
          <DropdownMenuTrigger aria-label="Thao tác dòng hàng" className="grid size-7 place-items-center rounded-full hover:bg-muted">
            <EllipsisVertical className="size-4" /></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 p-1.5">
            <DropdownMenuItem className={item} onClick={onRecentPrice}><HandCoins /> Xem giá bán gần nhất</DropdownMenuItem>
            <DropdownMenuItem className={item} onClick={() => setShowDiscount(true)}><BadgePercent /> Giảm giá</DropdownMenuItem>
            <DropdownMenuItem className={item} onClick={() => setShowNote(true)}><Pencil /> Ghi chú</DropdownMenuItem>
            <DropdownMenuItem className={item} onClick={onDetail}><Info /> Xem chi tiết</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {(showDiscount || l.discount > 0) && (
        <div className="flex items-center justify-end gap-2 pb-2 text-[13px] text-muted-foreground">
          Giảm giá / {unit.unitName}
          <span className="flex overflow-hidden rounded text-xs font-semibold">
            {(["VND", "%"] as const).map((m) => (
              <button key={m} type="button" onClick={() => setPercent(m === "%")}
                className={`px-1.5 py-0.5 ${(m === "%") === percent ? "bg-primary text-white" : "bg-[#eef0f3] text-foreground"}`}>{m}</button>))}
          </span>
          <NumberInput aria-label={percent ? "Giảm giá (%) mỗi đơn vị" : "Giảm giá mỗi đơn vị"} className={`${underlineInput} w-28 text-foreground`}
            value={percent ? pct : l.discount}
            onValueChange={(v) => update({ discount: Math.min(percent ? Math.round((l.unitPrice * Math.min(v, 100)) / 100) : v, l.unitPrice) })} />
        </div>
      )}
      {(s.showLineNote || showNote || l.note) && (
        <div className="pb-2.5" style={{ paddingLeft: s.showIndex ? 60 : 36 }}>
          <input aria-label="Ghi chú dòng hàng" placeholder="Ghi chú..." value={l.note} autoFocus={showNote && !l.note}
            className="h-8 w-full rounded-md border border-transparent px-2 text-xs outline-none placeholder:text-[#8a8f98] hover:border-[#d6d9de] focus:border-primary"
            onChange={(e) => update({ note: e.target.value })} onBlur={() => setShowNote(false)} />
        </div>
      )}
    </div>
  );
}
