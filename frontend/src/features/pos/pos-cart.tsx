"use client";

import { useState } from "react";
import { ShoppingBasket } from "lucide-react";
import { toast } from "sonner";
import { PosCartLine } from "./pos-cart-line";
import { PosProductDetailDrawer } from "./pos-product-detail-drawer";
import { PosQuickReturnLot } from "./pos-quick-return-lot";
import { RecentPriceDialog } from "./pos-recent-price-dialog";
import { newId } from "./pos-storage";
import { usePosLastPrices } from "./use-pos-last-prices";
import { usePosSettings } from "./use-pos-settings";
import type { PriceResolution } from "@/features/products/price-book-resolver";
import type { PosSettings } from "./pos-settings";
import type { CartLine, CatalogProduct, CatalogUnit } from "./pos-types";

type Props = {
  lines: CartLine[]; customerId: string | null; onChange: (fn: (lines: CartLine[]) => CartLine[]) => void;
  resolveUnit: (u: CatalogUnit) => PriceResolution; // giá theo bảng giá khi đổi đơn vị tính / thêm dòng
  products: CatalogProduct[]; branchId: string; quickReturn: boolean;
  selectedKey: string | null; onSelect: (key: string) => void;
};

/**
 * Thứ tự hiển thị theo Thiết lập (lines lưu hàng mới nhất trước; STT = thứ tự thêm vào):
 * Số thứ tự ↓ = mới nhất trên cùng, ↑ = cũ nhất trên cùng; Mã hàng / Tên hàng theo chiều đã chọn.
 */
export function displayLines(lines: CartLine[], s: Pick<PosSettings, "sortField" | "sortDesc">) {
  const withNo = lines.map((l, i) => ({ line: l, no: lines.length - i }));
  if (s.sortField === "INDEX") return s.sortDesc ? withNo : [...withNo].reverse();
  const key = (x: (typeof withNo)[number]) => (s.sortField === "CODE" ? x.line.units.find((u) => u.id === x.line.unitId)?.code ?? "" : x.line.productName);
  const sorted = [...withNo].sort((a, b) => key(a).localeCompare(key(b), "vi"));
  return s.sortDesc ? sorted.reverse() : sorted;
}

/** Giỏ hàng: mỗi dòng 1 thẻ trắng; kéo thả đổi thứ tự (khi bật và đang xếp theo số thứ tự). */
export function PosCart({ lines, customerId, onChange, resolveUnit, products, branchId, quickReturn, selectedKey, onSelect }: Props) {
  const { settings: s } = usePosSettings();
  const [dialog, setDialog] = useState<{ kind: "price" | "info"; line: CartLine } | null>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const lastPrice = usePosLastPrices(customerId, lines.map((l) => l.productId), s.showLastPrice && !quickReturn);
  const update = (key: string, patch: Partial<CartLine>) => onChange((all) => all.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const product = (id: string) => products.find((p) => p.id === id);
  const shown = displayLines(lines, s);
  const canDrag = s.dragDrop && s.sortField === "INDEX";

  function drop(targetKey: string) {
    if (!dragKey || dragKey === targetKey) return;
    const order = shown.map((x) => x.line);
    const from = order.findIndex((l) => l.key === dragKey), to = order.findIndex((l) => l.key === targetKey);
    const [moved] = order.splice(from, 1);
    order.splice(to, 0, moved);
    onChange(() => (s.sortDesc ? order : order.reverse()));
  }

  function addLine(l: CartLine) {
    const unit = l.units.find((u) => u.id === l.unitId) ?? l.units[0];
    const r = resolveUnit(unit);
    if (!r.allowed) { toast.warning(`${l.productName}: ${r.warning ?? "không được bán theo bảng giá này"}`); return; }
    onChange((all) => [{ ...l, key: newId(), quantity: 1, unitPrice: r.price, discount: 0, note: "", priceEdited: false, lotNumber: null }, ...all]);
  }

  if (!lines.length) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-[13px] text-muted-foreground">
        <ShoppingBasket className="size-14 stroke-1 text-[#c4c8ce]" />
        {quickReturn ? "Trả nhanh: tìm hàng (F3) hoặc quét mã vạch để thêm hàng khách trả" : "Chưa có hàng hóa — tìm hàng (F3) hoặc quét mã vạch"}
      </div>
    );
  }
  return (
    <div className="space-y-1">
      {shown.map(({ line: l, no }) => {
        const p = product(l.productId);
        const unit = l.units.find((u) => u.id === l.unitId);
        return (
          <PosCartLine key={l.key} line={l} index={no} settings={s} selected={l.key === selectedKey} onSelect={() => onSelect(l.key)}
            stock={p && unit ? p.stock / unit.conversionRate : null} lastPrice={lastPrice(l.productId, l.unitId)}
            update={(patch) => update(l.key, patch)} resolveUnit={resolveUnit} onAddLine={() => addLine(l)}
            onRemove={() => onChange((all) => all.filter((x) => x.key !== l.key))}
            onRecentPrice={() => setDialog({ kind: "price", line: l })} onDetail={() => setDialog({ kind: "info", line: l })}
            extra={quickReturn && p?.lotManaged ? <PosQuickReturnLot productId={l.productId} branchId={branchId} value={l.lotNumber}
              onChange={(lotNumber) => update(l.key, { lotNumber })} /> : undefined}
            drag={canDrag ? { draggable: true, onDragStart: () => setDragKey(l.key), onDragEnd: () => setDragKey(null),
              onDragOver: (e) => e.preventDefault(), onDrop: () => drop(l.key) } : undefined} />
        );
      })}
      {dialog?.kind === "price" && (
        <RecentPriceDialog productId={dialog.line.productId} productName={dialog.line.productName} customerId={customerId}
          onApply={(price) => update(dialog.line.key, { unitPrice: price, discount: 0, priceEdited: true })} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === "info" && (
        <PosProductDetailDrawer productId={dialog.line.productId} productName={dialog.line.productName} quantity={dialog.line.quantity}
          onApply={(quantity) => update(dialog.line.key, { quantity })} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}
