"use client";

import { NumberInput } from "@/components/number-input";
import { DocCodeLink } from "@/components/ui/doc-code-link";
import { formatMoney, formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { saleNs } from "@/messages/sale";
import { CART_GRID } from "./sale-cart-line";
import { underlineInput } from "./sale-ui-parts";
import type { DraftInvoice } from "./sale-types";

type Props = { draft: DraftInvoice; update: (patch: Partial<DraftInvoice>) => void };

/**
 * Tổng tiền phiếu trả (giống SalesReturnService): trả khách = tiền hàng trả − giảm giá − phí trả hàng.
 * Trả nhanh (không theo hóa đơn): tiền hàng trả = Σ SL × (đơn giá − giảm giá) của các dòng trong giỏ.
 */
export function returnTotals(d: DraftInvoice) {
  if (d.quickReturn) {
    const q = d.quickReturn;
    const subtotal = d.lines.reduce((s, l) => s + Math.round(l.quantity * (l.unitPrice - l.discount)), 0);
    const discount = Math.min(d.discount, subtotal);
    const fee = Math.min(q.fee, subtotal - discount);
    const total = subtotal - discount - fee;
    return { original: subtotal, subtotal, discount, fee, total, refund: Math.min(q.refund ?? total, total),
      qty: d.lines.reduce((s, l) => s + l.quantity, 0) };
  }
  const r = d.returnOf!;
  const original = r.lines.reduce((s, l) => s + Math.round(l.sold * l.price), 0);
  const subtotal = r.lines.reduce((s, l) => s + Math.round(l.quantity * l.price), 0);
  const discount = Math.min(d.discount, subtotal);
  const fee = Math.min(r.fee, subtotal - discount);
  const total = subtotal - discount - fee;
  return { original, subtotal, discount, fee, total, refund: r.refund ?? total, qty: r.lines.reduce((s, l) => s + l.quantity, 0) };
}

/** Danh sách hàng trên hóa đơn (thẻ trắng như giỏ hàng): nhập SL trả, dưới ô là "/ tối đa" (= đã mua − đã trả). */
export function ReturnLines({ draft, update }: Props) {
  const t = useT(saleNs);
  const r = draft.returnOf!;
  const set = (id: string, quantity: number) =>
    update({ returnOf: { ...r, lines: r.lines.map((l) => (l.invoiceLineId === id ? { ...l, quantity } : l)) } });
  return (
    <div className="space-y-1">
      {r.lines.map((l, i) => {
        const max = l.sold - l.returned;
        return (
          <div key={l.invoiceLineId} className={`${CART_GRID} min-h-[66px] rounded-lg bg-background px-3 py-2 text-[13px] shadow-[0_1px_2px_rgba(0,0,0,0.08)]`}>
            <span className="text-center">{i + 1}</span><span />
            <span className="truncate"><DocCodeLink code={l.productCode} kind="/products" newTab /></span>
            <span className="truncate" title={l.productName}>{l.productName}</span>
            <span><span className="rounded bg-primary-tint px-1.5 py-0.5 text-primary">{l.unitName}</span></span>
            <div className="px-3.5 text-center">
              <NumberInput aria-label={t("returns.qtyOf", { name: l.productName })} className={`${underlineInput} text-center`} disabled={max <= 0} value={l.quantity}
                onValueChange={(q) => set(l.invoiceLineId, Math.min(Math.max(q, 0), max))} />
              <span className="mt-1 block text-[#6b7280]">/ {formatNumber(max)}</span>
              {l.returned > 0 && <span className="block text-xs text-[#6b7280]">{t("returns.returnedQty", { qty: formatNumber(l.returned) })}</span>}
            </div>
            <span className="border-b border-[#c8ccd2] pb-1 text-right">{formatMoney(l.price)}</span>
            <span className="text-right font-bold">{formatMoney(Math.round(l.quantity * l.price))}</span>
            <span />
          </div>
        );
      })}
    </div>
  );
}
