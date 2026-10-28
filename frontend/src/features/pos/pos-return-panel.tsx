"use client";

import { NumberInput } from "@/components/number-input";
import { Button } from "@/components/ui/button";
import { PAYMENT_METHODS } from "@/features/sales/sales-types";
import { formatMoney, formatNumber } from "@/lib/format";
import type { DraftInvoice } from "./pos-types";

type Props = { draft: DraftInvoice; update: (patch: Partial<DraftInvoice>) => void; onSubmit: () => void; busy: boolean };

/** Tổng tiền phiếu trả (giống SalesReturnService): trả khách = tiền hàng trả − giảm giá − phí trả hàng. */
export function returnTotals(d: DraftInvoice) {
  const r = d.returnOf!;
  const original = r.lines.reduce((s, l) => s + Math.round(l.sold * l.price), 0);
  const subtotal = r.lines.reduce((s, l) => s + Math.round(l.quantity * l.price), 0);
  const discount = Math.min(d.discount, subtotal);
  const fee = Math.min(r.fee, subtotal - discount);
  const total = subtotal - discount - fee;
  return { original, subtotal, discount, fee, total, refund: r.refund ?? total, qty: r.lines.reduce((s, l) => s + l.quantity, 0) };
}

/** Danh sách hàng trên hóa đơn: nhập SL trả (tối đa = đã mua − đã trả). */
export function ReturnLines({ draft, update }: Pick<Props, "draft" | "update">) {
  const r = draft.returnOf!;
  const set = (id: string, quantity: number) =>
    update({ returnOf: { ...r, lines: r.lines.map((l) => (l.invoiceLineId === id ? { ...l, quantity } : l)) } });
  return (
    <div className="space-y-2">
      {r.lines.map((l, i) => {
        const max = l.sold - l.returned;
        return (
          <div key={l.invoiceLineId} className="grid grid-cols-[2rem_7rem_1fr_auto_8rem_8rem_7rem] items-center gap-2 rounded-lg border bg-background p-3 text-sm shadow-sm">
            <span className="text-muted-foreground">{i + 1}</span><span>{l.productCode}</span>
            <span className="font-medium">{l.productName}</span>
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">{l.unitName}</span>
            <div className="text-center">
              <NumberInput className="h-7 border-0 border-b text-center shadow-none" disabled={max <= 0} value={l.quantity}
                onValueChange={(q) => set(l.invoiceLineId, Math.min(Math.max(q, 0), max))} />
              <span className="text-xs text-muted-foreground">/ {formatNumber(max)}{l.returned > 0 && ` (đã trả ${formatNumber(l.returned)})`}</span>
            </div>
            <span className="text-right">{formatMoney(l.price)}</span>
            <span className="text-right font-semibold">{formatMoney(Math.round(l.quantity * l.price))}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Cột phải tab trả hàng: tổng tiền, giảm giá, phí trả hàng, cần trả khách, tiền trả khách, TRẢ HÀNG. */
export function ReturnCheckout({ draft, update, onSubmit, busy }: Props) {
  const r = draft.returnOf!;
  const t = returnTotals(draft);
  return (
    <div className="flex h-full flex-col gap-3 text-sm">
      <div className="rounded-md bg-muted px-3 py-2 font-semibold text-primary">{draft.customer ? `${draft.customer.name} ${draft.customer.phone ?? ""}` : "Khách lẻ"}</div>
      <p className="text-base font-semibold text-green-600">Trả hàng / <span className="text-primary">{r.code}</span></p>
      <div className="space-y-2.5">
        <div className="flex justify-between"><span>Tổng giá gốc hàng mua</span><span>{formatMoney(t.original)}</span></div>
        <div className="flex justify-between"><span>Tổng tiền hàng trả <span className="ml-4 text-muted-foreground">{formatNumber(t.qty)}</span></span><span>{formatMoney(t.subtotal)}</span></div>
        <div className="flex items-center justify-between"><span>Giảm giá</span>
          <NumberInput className="h-7 w-32 border-0 border-b shadow-none" value={draft.discount} onValueChange={(discount) => update({ discount })} /></div>
        <div className="flex items-center justify-between"><span>Phí trả hàng</span>
          <NumberInput className="h-7 w-32 border-0 border-b shadow-none" value={r.fee} onValueChange={(fee) => update({ returnOf: { ...r, fee } })} /></div>
        <div className="flex justify-between font-semibold"><span>Cần trả khách</span><span className="text-lg text-primary">{formatMoney(t.total)}</span></div>
        <div className="flex items-center justify-between font-semibold"><span>Tiền trả khách</span>
          <NumberInput className="h-7 w-32 border-0 border-b shadow-none" value={t.refund}
            onValueChange={(refund) => update({ returnOf: { ...r, refund: Math.min(refund, t.total) } })} /></div>
        <div className="flex flex-wrap gap-1.5">
          {PAYMENT_METHODS.map((m) => (
            <button key={m.value} type="button" onClick={() => update({ paymentMethod: m.value })}
              className={`rounded-full border px-3 py-1 text-xs ${draft.paymentMethod === m.value ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}>{m.label}</button>))}
        </div>
        {t.refund < t.total && draft.customer && (
          <div className="flex justify-between text-orange-600"><span>Trừ vào công nợ khách</span><span>{formatMoney(t.total - t.refund)}</span></div>)}
      </div>
      <textarea className="min-h-16 rounded-md border bg-transparent p-2 outline-none" placeholder="Ghi chú" value={draft.note}
        onChange={(e) => update({ note: e.target.value })} />
      <Button className="mt-auto h-12 text-base font-bold" disabled={busy || t.qty <= 0} onClick={onSubmit}>{busy ? "ĐANG LƯU..." : "TRẢ HÀNG"}</Button>
    </div>
  );
}
