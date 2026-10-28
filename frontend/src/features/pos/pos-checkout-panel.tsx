"use client";

import { useEffect, useState } from "react";
import { QrCode } from "lucide-react";
import { QrPaymentDialog } from "@/features/sales/qr-payment-dialog";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/number-input";
import { formatMoney, formatNumber } from "@/lib/format";
import { PosCustomerPicker } from "./pos-customer-picker";
import { PosSellerPicker } from "./pos-seller-picker";
import { PaymentMethodRadios, PosDateTime, SummaryRow, underlineInput } from "./pos-ui-parts";
import { cartTotals } from "./use-pos-tabs";
import type { DraftInvoice, PosCustomer } from "./pos-types";

type Props = {
  draft: DraftInvoice;
  branchId: string;
  update: (patch: Partial<DraftInvoice>) => void;
  onPay: () => void;
  paying: boolean;
};

/**
 * Chọn khách: khách thuộc nhóm có giảm giá → tự điền giảm giá hóa đơn (% tính lại theo giỏ hàng; vẫn sửa tay được).
 * Bỏ chọn khách khi đang giảm theo % của nhóm → bỏ luôn giảm giá đó.
 */
function customerPatch(customer: PosCustomer | null, draft: DraftInvoice): Partial<DraftInvoice> {
  if (!customer && draft.discountPercent != null) return { customer, discountPercent: null, discount: 0 };
  const g = customer?.groupDiscount;
  if (!g) return { customer };
  return g.type === "PERCENT" ? { customer, discountPercent: g.value } : { customer, discount: g.value, discountPercent: null };
}

/**
 * Cột phải màn bán hàng: người bán, ngày giờ, khách, tổng tiền, giảm giá, khách thanh toán (+QR), THANH TOÁN (F9).
 * Tab đặt hàng: "Khách thanh toán" là tiền đặt cọc, nút ĐẶT HÀNG; hóa đơn từ đơn đặt hàng: trừ tiền cọc vào khách cần trả.
 */
export function PosCheckoutPanel({ draft, branchId, update, onPay, paying }: Props) {
  const [qr, setQr] = useState(false);
  const [autoPay, setAutoPay] = useState(false);
  const t = cartTotals(draft);
  const order = draft.kind === "ORDER";
  const ref = draft.orderOf ?? draft.fromOrder;
  const change = t.paid - t.due;

  // SePay báo đã nhận đủ tiền + bật tự hoàn thành → thanh toán hóa đơn ngay khi số tiền đã cập nhật vào tab
  useEffect(() => {
    if (autoPay && draft.paymentMethod === "TRANSFER") { setAutoPay(false); setQr(false); onPay(); }
  }, [autoPay, draft, onPay]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "F9") { e.preventDefault(); onPay(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onPay]);

  return (
    <div className="flex h-full flex-col text-[13px]">
      <div className="flex h-8 items-center justify-between gap-3">
        <PosSellerPicker value={draft.sellerId} onChange={(sellerId) => update({ sellerId })} />
        <PosDateTime />
      </div>
      <div className="mt-2"><PosCustomerPicker value={draft.customer} branchId={branchId} onChange={(c) => update(customerPatch(c))} /></div>
      {ref && <p className="mt-3 text-[13px] font-bold text-[#16a34a]">{order ? "Đặt hàng" : "Hóa đơn từ đơn"} / <span className="font-medium text-primary">{ref.code}</span></p>}
      <div className="mt-4 space-y-1 border-t border-dashed border-[#d6d9de] pt-3">
        <SummaryRow label="Tổng tiền hàng" sub={t.quantity}>{formatMoney(t.subtotal)}</SummaryRow>
        <SummaryRow label={draft.discountPercent != null ? `Giảm giá (${formatNumber(draft.discountPercent)}%)` : "Giảm giá"}>
          <NumberInput aria-label="Giảm giá hóa đơn" className={`${underlineInput} w-[104px] text-[15px]`} value={t.discount}
            onValueChange={(discount) => update({ discount, discountPercent: null })} />
        </SummaryRow>
        <SummaryRow label="Khách cần trả" bold><span className="text-[17px] text-primary">{formatMoney(t.total)}</span></SummaryRow>
        {t.deposit > 0 && <SummaryRow label={order ? "Khách đã trả" : "Đã đặt cọc"}>{formatMoney(t.deposit)}</SummaryRow>}
        <SummaryRow bold label={<>Khách thanh toán
          <button type="button" title="Thanh toán qua mã QR" aria-label="Thanh toán qua mã QR" className="text-[#4b5563] hover:text-primary"
            onClick={() => { update({ paymentMethod: "TRANSFER" }); setQr(true); }}><QrCode className="size-4" /></button></>}>
          <NumberInput aria-label="Khách thanh toán" className={`${underlineInput} w-[104px] font-normal`} value={t.paid}
            onValueChange={(paid) => update({ paid })} />
        </SummaryRow>
        <PaymentMethodRadios value={draft.paymentMethod} onChange={(paymentMethod) => update({ paymentMethod })} />
        {change > 0 && <SummaryRow label="Tiền thừa trả khách">{formatMoney(change)}</SummaryRow>}
        {change < 0 && !order && <div className="text-destructive"><SummaryRow label="Tính vào công nợ">{formatMoney(-change)}</SummaryRow></div>}
        {change < 0 && order && <SummaryRow label="Còn phải trả khi nhận hàng">{formatMoney(-change)}</SummaryRow>}
      </div>
      <Button title="F9" className="mt-auto h-12 w-full rounded-md text-[15px] font-bold uppercase" disabled={paying || !draft.lines.length} onClick={onPay}>
        {paying ? "Đang lưu..." : order ? (draft.orderOf ? "Lưu đơn" : "Đặt hàng") : "Thanh toán"}
      </Button>
      {qr && <QrPaymentDialog amount={t.paid} info={draft.editOf?.code ?? ref?.code ?? draft.label} onClose={() => setQr(false)}
        onPaid={draft.editOf ? undefined : (paid, auto) => { update({ paid, paymentMethod: "TRANSFER" }); if (auto) setAutoPay(true); }} />}
    </div>
  );
}
