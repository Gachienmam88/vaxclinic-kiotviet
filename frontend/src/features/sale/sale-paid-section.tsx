"use client";

import { useState } from "react";
import { EllipsisVertical, QrCode } from "lucide-react";
import { NumberInput } from "@/components/number-input";
import { methodLabel } from "@/features/sales/sales-types";
import { formatMoney } from "@/lib/format";
import { SaleMixedPaymentDialog } from "./sale-mixed-payment-dialog";
import { suggestedAmounts } from "./sale-suggested-amounts";
import { PaymentMethodRadios, SummaryRow, underlineInput } from "./sale-ui-parts";
import type { DraftInvoice } from "./sale-types";

type Props = {
  draft: DraftInvoice; paid: number; due: number; allowMixed: boolean; suggest: boolean;
  update: (patch: Partial<DraftInvoice>) => void; onQr: () => void;
};

/**
 * "Khách thanh toán" (F8, id sale-paid) + mã QR, phương thức (Tiền mặt / Chuyển khoản / Thẻ / Ví) + ⋮ thanh toán nhiều
 * phương thức, và các ô gợi ý số tiền khách đưa. Sửa tay số tiền / đổi phương thức → bỏ chia nhiều phương thức.
 */
export function SalePaidSection({ draft, paid, due, allowMixed, suggest, update, onQr }: Props) {
  const [mixed, setMixed] = useState(false);
  const extras = draft.extraPayments ?? [];
  const chips = suggest ? suggestedAmounts(due) : [];
  return (
    <>
      <SummaryRow bold label={<>Khách thanh toán
        <button type="button" title="Thanh toán qua mã QR" aria-label="Thanh toán qua mã QR" className="text-[#4b5563] hover:text-primary"
          onClick={onQr}><QrCode className="size-4" /></button></>}>
        <NumberInput aria-label="Khách thanh toán" id="sale-paid" className={`${underlineInput} w-[104px] font-normal`} value={paid}
          onValueChange={(v) => update({ paid: v, extraPayments: [] })} />
      </SummaryRow>
      <div className="flex items-center gap-1">
        <div className="flex-1"><PaymentMethodRadios value={draft.paymentMethod} onChange={(paymentMethod) => update({ paymentMethod, extraPayments: [] })} /></div>
        {allowMixed && <button type="button" aria-label="Thanh toán nhiều phương thức" title="Thanh toán nhiều phương thức"
          className="grid size-7 place-items-center rounded bg-[#eef0f3] hover:bg-[#e2e5e9]" onClick={() => setMixed(true)}>
          <EllipsisVertical className="size-4" /></button>}
      </div>
      {extras.length > 0 && (
        <p className="text-xs text-[#4b5563]">
          {[{ method: draft.paymentMethod, amount: paid - extras.reduce((s, e) => s + e.amount, 0) }, ...extras]
            .map((e) => `${methodLabel(e.method)} ${formatMoney(e.amount)}`).join(" · ")}
        </p>
      )}
      {chips.length > 0 && (
        <div className="flex min-h-[68px] flex-wrap content-start gap-1.5 rounded-md bg-[#eef0f3] p-2">
          {chips.map((c) => (
            <button key={c} type="button" onClick={() => update({ paid: c, extraPayments: [] })}
              className={`h-[26px] rounded-full border bg-background px-3 text-[13px] ${c === paid ? "border-primary text-primary" : "border-[#9ca3af]"}`}>
              {formatMoney(c)}</button>
          ))}
        </div>
      )}
      {mixed && <SaleMixedPaymentDialog due={due} method={draft.paymentMethod} paid={paid} extras={extras} onClose={() => setMixed(false)}
        onSave={(v) => update(v)} />}
    </>
  );
}
