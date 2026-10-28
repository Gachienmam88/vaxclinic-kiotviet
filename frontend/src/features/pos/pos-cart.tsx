"use client";

import { useState } from "react";
import { EllipsisVertical, Minus, Plus, Trash2 } from "lucide-react";
import { NumberInput } from "@/components/number-input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatMoney } from "@/lib/format";
import type { CartLine } from "./pos-types";

type Props = { lines: CartLine[]; customerId: string | null; onChange: (fn: (lines: CartLine[]) => CartLine[]) => void };

/** Giỏ hàng: STT, xóa, mã, tên, đơn vị, SL (+/−), đơn giá (sửa được), thành tiền, menu (giá gần nhất, giảm giá, ghi chú, chi tiết). */
export function PosCart({ lines, customerId, onChange }: Props) {
  const [showDiscount, setShowDiscount] = useState<Record<string, boolean>>({});
  const [showNote, setShowNote] = useState<Record<string, boolean>>({});
  const [dialog, setDialog] = useState<{ kind: "price" | "info"; line: CartLine } | null>(null);
  const update = (key: string, patch: Partial<CartLine>) => onChange((all) => all.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  if (!lines.length) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Chưa có hàng hóa — tìm hàng (F3) hoặc quét mã vạch</div>;
  }
  return (
    <div className="space-y-2">
      {lines.map((l, i) => {
        const unit = l.units.find((u) => u.id === l.unitId) ?? l.units[0];
        return (
          <div key={l.key} className="rounded-lg border bg-background p-3 shadow-sm">
            <div className="grid grid-cols-[2rem_1.5rem_7rem_1fr_auto_8rem_8rem_7rem_2rem] items-center gap-2 text-sm">
              <span className="text-muted-foreground">{lines.length - i}</span>
              <button aria-label="Xóa dòng" className="text-muted-foreground hover:text-destructive"
                onClick={() => onChange((all) => all.filter((x) => x.key !== l.key))}><Trash2 className="size-4" /></button>
              <span className="truncate">{unit.code}</span>
              <span className="truncate font-medium">{l.productName}</span>
              {l.units.length > 1 ? (
                <select className="rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary" value={l.unitId}
                  onChange={(e) => {
                    const u = l.units.find((x) => x.id === e.target.value)!;
                    update(l.key, { unitId: u.id, unitPrice: u.price, discount: 0 });
                  }}>
                  {l.units.map((u) => <option key={u.id} value={u.id}>{u.unitName}</option>)}
                </select>
              ) : <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">{unit.unitName}</span>}
              <div className="flex items-center gap-1">
                <button aria-label="Giảm" onClick={() => update(l.key, { quantity: Math.max(1, l.quantity - 1) })}><Minus className="size-3.5" /></button>
                <NumberInput className="h-7 border-0 border-b text-center shadow-none" value={l.quantity}
                  onValueChange={(quantity) => update(l.key, { quantity: Math.max(quantity, 0) })} />
                <button aria-label="Tăng" onClick={() => update(l.key, { quantity: l.quantity + 1 })}><Plus className="size-3.5" /></button>
              </div>
              <NumberInput className="h-7 border-0 border-b shadow-none" value={l.unitPrice} onValueChange={(unitPrice) => update(l.key, { unitPrice })} />
              <span className="text-right font-semibold">{formatMoney(Math.round(l.quantity * (l.unitPrice - l.discount)))}</span>
              <DropdownMenu>
                <DropdownMenuTrigger aria-label="Thêm" className="rounded p-1 hover:bg-muted"><EllipsisVertical className="size-4" /></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setDialog({ kind: "price", line: l })}>Xem giá bán gần nhất</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowDiscount({ ...showDiscount, [l.key]: true })}>Giảm giá</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowNote({ ...showNote, [l.key]: true })}>Ghi chú</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setDialog({ kind: "info", line: l })}>Xem chi tiết</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {(showDiscount[l.key] || l.discount > 0) && (
              <div className="mt-2 flex items-center justify-end gap-2 text-sm">
                <span className="text-muted-foreground">Giảm giá / {unit.unitName}</span>
                <NumberInput className="h-7 w-32" value={l.discount}
                  onValueChange={(discount) => update(l.key, { discount: Math.min(discount, l.unitPrice) })} />
              </div>
            )}
            {(showNote[l.key] || l.note) && (
              <input className="mt-2 w-full border-b bg-transparent text-sm outline-none" placeholder="Ghi chú..." value={l.note}
                autoFocus={showNote[l.key] && !l.note} onChange={(e) => update(l.key, { note: e.target.value })} />
            )}
          </div>
        );
      })}
    </div>
  );
}
