"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/number-input";
import { useUserLookup } from "@/features/purchases/purchase-queries";
import { PAYMENT_METHODS } from "@/features/sales/sales-types";
import { formatMoney } from "@/lib/format";
import { PosCustomerPicker } from "./pos-customer-picker";
import { cartTotals } from "./use-pos-tabs";
import type { DraftInvoice } from "./pos-types";

type Props = {
  draft: DraftInvoice;
  branchId: string;
  update: (patch: Partial<DraftInvoice>) => void;
  onPay: () => void;
  paying: boolean;
};

/** Cột phải màn bán hàng: người bán, khách, tổng tiền, giảm giá, khách thanh toán, THANH TOÁN (F9). */
export function PosCheckoutPanel({ draft, branchId, update, onPay, paying }: Props) {
  const { data: users = [] } = useUserLookup();
  const t = cartTotals(draft);
  const change = t.paid - t.total;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "F9") { e.preventDefault(); onPay(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onPay]);

  return (
    <div className="flex h-full flex-col gap-3 text-sm">
      <div className="flex items-center justify-between">
        <select className="max-w-48 bg-transparent font-medium outline-none" value={draft.sellerId} aria-label="Người bán"
          onChange={(e) => update({ sellerId: e.target.value })}>
          {users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
        </select>
        <span className="text-muted-foreground">{new Date().toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
      </div>
      <PosCustomerPicker value={draft.customer} branchId={branchId} onChange={(customer) => update({ customer })} />
      <div className="space-y-2.5 border-t border-dashed pt-3">
        <div className="flex justify-between"><span>Tổng tiền hàng <span className="ml-6 text-muted-foreground">{t.quantity}</span></span><span>{formatMoney(t.subtotal)}</span></div>
        <div className="flex items-center justify-between"><span>Giảm giá</span>
          <NumberInput className="h-7 w-32 border-0 border-b shadow-none" value={draft.discount} onValueChange={(discount) => update({ discount })} /></div>
        <div className="flex justify-between font-semibold"><span>Khách cần trả</span><span className="text-lg text-primary">{formatMoney(t.total)}</span></div>
        <div className="flex items-center justify-between font-semibold"><span>Khách thanh toán</span>
          <NumberInput className="h-7 w-32 border-0 border-b shadow-none" value={t.paid} onValueChange={(paid) => update({ paid })} /></div>
        <div className="flex flex-wrap gap-1.5">
          {PAYMENT_METHODS.map((m) => (
            <button key={m.value} type="button" onClick={() => update({ paymentMethod: m.value })}
              className={`rounded-full border px-3 py-1 text-xs ${draft.paymentMethod === m.value ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
              {m.label}</button>))}
        </div>
        {change > 0 && <div className="flex justify-between"><span>Tiền thừa trả khách</span><span className="font-semibold">{formatMoney(change)}</span></div>}
        {change < 0 && <div className="flex justify-between text-destructive"><span>Tính vào công nợ</span><span className="font-semibold">{formatMoney(-change)}</span></div>}
      </div>
      <textarea className="min-h-16 rounded-md border bg-transparent p-2 outline-none" placeholder="Ghi chú đơn hàng" value={draft.note}
        onChange={(e) => update({ note: e.target.value })} />
      <Button className="mt-auto h-12 text-base font-bold" disabled={paying || !draft.lines.length} onClick={onPay}>
        {paying ? "ĐANG LƯU..." : "THANH TOÁN (F9)"}
      </Button>
    </div>
  );
}
