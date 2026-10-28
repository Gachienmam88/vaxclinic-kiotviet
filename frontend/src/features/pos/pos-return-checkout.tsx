"use client";

import { UserRound } from "lucide-react";
import { NumberInput } from "@/components/number-input";
import { Button } from "@/components/ui/button";
import { useUserLookup } from "@/features/purchases/purchase-queries";
import { formatMoney, formatNumber } from "@/lib/format";
import { PosCustomerPicker } from "./pos-customer-picker";
import { returnTotals } from "./pos-return-panel";
import { PaymentMethodRadios, PosDateTime, SummaryRow, underlineInput } from "./pos-ui-parts";
import type { DraftInvoice } from "./pos-types";

type Props = {
  draft: DraftInvoice; branchId: string; update: (patch: Partial<DraftInvoice>) => void; onSubmit: () => void; busy: boolean;
};

/**
 * Cột phải tab trả hàng: người bán, khách, "Trả hàng / HDxxx" (hoặc "Trả nhanh"), tổng tiền, giảm giá, phí trả hàng,
 * cần trả khách, tiền trả khách, TRẢ HÀNG. Trả nhanh: chọn khách được (khách lẻ phải trả đủ tiền).
 */
export function ReturnCheckout({ draft, branchId, update, onSubmit, busy }: Props) {
  const { data: users = [] } = useUserLookup();
  const r = draft.returnOf;
  const q = draft.quickReturn;
  const t = returnTotals(draft);
  const seller = users.find((u) => u.id === draft.sellerId)?.fullName;
  const input = `${underlineInput} w-[104px] text-[15px]`;
  const setFee = (fee: number) => (r ? update({ returnOf: { ...r, fee } }) : q && update({ quickReturn: { ...q, fee } }));
  const setRefund = (refund: number) => (r ? update({ returnOf: { ...r, refund: Math.min(refund, t.total) } })
    : q && update({ quickReturn: { ...q, refund: Math.min(refund, t.total) } }));

  return (
    <div className="flex h-full flex-col text-[13px]">
      <div className="flex h-8 items-center justify-between gap-3">
        <span className="truncate font-medium">{seller ?? ""}</span>
        <PosDateTime />
      </div>
      {q ? (
        <div className="mt-2"><PosCustomerPicker value={draft.customer} branchId={branchId} onChange={(customer) => update({ customer })} /></div>
      ) : (
        <div className="mt-2 flex min-h-[30px] items-center gap-2 rounded-md bg-[#eef0f3] px-2.5 py-1">
          <UserRound className="size-3.5 fill-[#6b7280] text-[#6b7280]" />
          <span className="font-bold text-primary">{draft.customer ? `${draft.customer.name} ${draft.customer.phone ?? ""}` : "Khách lẻ"}</span>
        </div>
      )}
      <p className="mt-4 mb-1 text-[15px] font-bold text-[#16a34a]">
        {r ? <>Trả hàng / <span className="text-[13px] font-medium text-primary">{r.code}</span></> : "Trả nhanh (không theo hóa đơn)"}</p>
      <div className="space-y-1">
        {r && <SummaryRow label="Tổng giá gốc hàng mua">{formatMoney(t.original)}</SummaryRow>}
        <SummaryRow label="Tổng tiền hàng trả" sub={formatNumber(t.qty)}>{formatMoney(t.subtotal)}</SummaryRow>
        <SummaryRow label="Giảm giá">
          <NumberInput aria-label="Giảm giá" className={input} value={draft.discount} onValueChange={(discount) => update({ discount })} />
        </SummaryRow>
        <SummaryRow label="Phí trả hàng">
          <NumberInput aria-label="Phí trả hàng" className={input} value={t.fee} onValueChange={setFee} />
        </SummaryRow>
        <SummaryRow label="Cần trả khách" bold><span className="text-[17px] text-primary">{formatMoney(t.total)}</span></SummaryRow>
        <SummaryRow label="Tiền trả khách" bold>
          <NumberInput aria-label="Tiền trả khách" id="pos-paid" className={`${input} font-normal`} value={t.refund} onValueChange={setRefund} />
        </SummaryRow>
        <PaymentMethodRadios value={draft.paymentMethod} onChange={(paymentMethod) => update({ paymentMethod })} />
        {t.refund < t.total && draft.customer && (
          <div className="text-orange-600"><SummaryRow label="Trừ vào công nợ khách">{formatMoney(t.total - t.refund)}</SummaryRow></div>)}
      </div>
      <Button title="F9" className="mt-auto h-12 w-full rounded-md text-[15px] font-bold uppercase" disabled={busy || t.qty <= 0} onClick={onSubmit}>
        {busy ? "Đang lưu..." : "Trả hàng"}
      </Button>
    </div>
  );
}
