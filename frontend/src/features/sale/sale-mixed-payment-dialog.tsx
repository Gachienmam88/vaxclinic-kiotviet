"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NumberInput } from "@/components/number-input";
import { PAYMENT_METHODS } from "@/features/sales/sales-types";
import { formatMoney } from "@/lib/format";
import { underlineInput } from "./sale-ui-parts";
import type { DraftInvoice, ExtraPayment } from "./sale-types";

type Method = DraftInvoice["paymentMethod"];
type Props = {
  due: number; method: Method; paid: number; extras: ExtraPayment[];
  onSave: (v: { paymentMethod: Method; paid: number; extraPayments: ExtraPayment[] }) => void; onClose: () => void;
};

/**
 * "Thanh toán nhiều phương thức" (⋮ cạnh phương thức): chia tiền khách trả cho Tiền mặt / Chuyển khoản / Thẻ / Ví.
 * Phương thức nhiều tiền nhất là phương thức chính (phiếu TT{mã}), các phần còn lại thành phiếu thu TT{mã}-2, -3...
 * Chỉ tiền mặt được vượt số cần trả (tiền thừa trả khách).
 */
export function SaleMixedPaymentDialog({ due, method, paid, extras, onSave, onClose }: Props) {
  const [amounts, setAmounts] = useState<Record<Method, number>>(() => {
    const init = { CASH: 0, TRANSFER: 0, CARD: 0, EWALLET: 0 } as Record<Method, number>;
    init[method] = Math.max(0, paid - extras.reduce((s, e) => s + e.amount, 0));
    for (const e of extras) init[e.method] += e.amount;
    return init;
  });
  const total = Object.values(amounts).reduce((s, v) => s + v, 0);
  const nonCash = total - amounts.CASH;
  const error = nonCash > due ? "Chuyển khoản / thẻ / ví không được vượt số khách cần trả" : null;

  function save() {
    const used = (Object.entries(amounts) as [Method, number][]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    if (!used.length) { onSave({ paymentMethod: method, paid: 0, extraPayments: [] }); onClose(); return; }
    const [primary, ...rest] = used;
    onSave({ paymentMethod: primary[0], paid: total, extraPayments: rest.map(([m, amount]) => ({ method: m, amount })) });
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-4 p-6 text-[13px] sm:max-w-[420px]">
        <DialogHeader><DialogTitle className="text-[15px] font-bold">Thanh toán nhiều phương thức</DialogTitle></DialogHeader>
        <div className="flex justify-between font-bold"><span>Khách cần trả</span><span className="text-primary">{formatMoney(due)}</span></div>
        <div className="space-y-2">
          {PAYMENT_METHODS.map((m) => (
            <label key={m.value} className="flex items-center justify-between gap-3">
              {m.label}
              <NumberInput aria-label={m.label} className={`${underlineInput} w-36`} value={amounts[m.value]}
                onValueChange={(v) => setAmounts((a) => ({ ...a, [m.value]: v }))} />
            </label>
          ))}
        </div>
        <div className="flex justify-between border-t border-dashed pt-2 font-bold"><span>Khách thanh toán</span><span>{formatMoney(total)}</span></div>
        {total > due && !error && <div className="flex justify-between"><span>Tiền thừa trả khách</span><span>{formatMoney(total - due)}</span></div>}
        {error && <p className="text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" className="h-9 border-primary px-5 text-primary" onClick={onClose}>Bỏ qua</Button>
          <Button className="h-9 px-6" disabled={!!error} onClick={save}>Xong</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
