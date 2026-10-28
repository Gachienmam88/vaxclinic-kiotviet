"use client";

import { useEffect, useState } from "react";
import { QrPaymentDialog } from "@/features/sales/qr-payment-dialog";
import { Button } from "@/components/ui/button";
import { DocCodeLink } from "@/components/ui/doc-code-link";
import { NumberInput } from "@/components/number-input";
import { formatMoney, formatNumber } from "@/lib/format";
import { SaleChannelPicker } from "./sale-channel-picker";
import { SaleCustomerPicker } from "./sale-customer-picker";
import { SalePaidSection } from "./sale-paid-section";
import { SalePriceBookSelect } from "./sale-price-book-select";
import { SaleSellerPicker } from "./sale-seller-picker";
import { SaleDateTime, SummaryRow, underlineInput } from "./sale-ui-parts";
import { useSaleSettings } from "./use-sale-settings";
import { cartTotals } from "./use-sale-tabs";
import type { DraftInvoice, SaleCustomer } from "./sale-types";
import type { SalePriceBook } from "./use-sale-price-book";
import type { SaleLookups } from "./use-sale-lookups";
import { DateTimePicker } from "@/components/ui/date-time-picker";

type Props = {
  draft: DraftInvoice;
  branchId: string;
  update: (patch: Partial<DraftInvoice>) => void;
  onPay: () => void;
  paying: boolean;
  priceBook: SalePriceBook;
  lookups: SaleLookups;
};

/**
 * Chọn khách: khách thuộc nhóm có giảm giá → tự điền giảm giá hóa đơn (% tính lại theo giỏ hàng; vẫn sửa tay được).
 * Bỏ chọn khách khi đang giảm theo % của nhóm → bỏ luôn giảm giá đó.
 */
function customerPatch(customer: SaleCustomer | null, draft: DraftInvoice): Partial<DraftInvoice> {
  if (!customer && draft.discountPercent != null) return { customer, discountPercent: null, discount: 0 };
  const g = customer?.groupDiscount;
  if (!g) return { customer };
  return g.type === "PERCENT" ? { customer, discountPercent: g.value } : { customer, discount: g.value, discountPercent: null };
}

/**
 * Cột phải màn bán hàng (như KiotViet): người bán · kênh bán (🚶▾) · ngày giờ; khách (F4) + bảng giá; Tổng tiền hàng,
 * Giảm giá, Khách cần trả, Khách thanh toán (+QR, nhiều phương thức, gợi ý số tiền), THANH TOÁN (F9).
 * Tab đặt hàng: "Khách thanh toán" là tiền đặt cọc, nút ĐẶT HÀNG, Thời gian giao hàng; hóa đơn từ đơn đặt hàng: trừ tiền cọc.
 * Bán giao hàng: phần khách chưa trả = Thu hộ (COD) của vận đơn.
 */
export function SaleCheckoutPanel({ draft, branchId, update, onPay, paying, priceBook, lookups }: Props) {
  const { settings } = useSaleSettings();
  const [qr, setQr] = useState(false);
  const [autoPay, setAutoPay] = useState(false);
  const t = cartTotals(draft);
  const order = draft.kind === "ORDER";
  const ref = draft.orderOf ?? draft.fromOrder;
  const change = t.paid - t.due;
  const delivery = draft.mode === "DELIVERY" && !order;

  // SePay báo đã nhận đủ tiền + bật tự hoàn thành → thanh toán hóa đơn ngay khi số tiền đã cập nhật vào tab
  useEffect(() => {
    if (autoPay && draft.paymentMethod === "TRANSFER") { setAutoPay(false); setQr(false); onPay(); }
  }, [autoPay, draft, onPay]);

  return (
    <div className="flex h-full flex-col text-[13px]">
      <div className="flex h-8 items-center gap-2">
        <SaleSellerPicker value={draft.sellerId} onChange={(sellerId) => update({ sellerId })} />
        <SaleChannelPicker value={draft.salesChannel ?? "DIRECT"} lookups={lookups} onChange={(salesChannel) => update({ salesChannel })} />
        <span className="ml-auto"><SaleDateTime /></span>
      </div>
      <div className="mt-2 flex items-start gap-3">
        <div className="min-w-0 flex-1"><SaleCustomerPicker value={draft.customer} branchId={branchId} onChange={(c) => update(customerPatch(c, draft))} /></div>
        <SalePriceBookSelect options={priceBook.options} value={priceBook.value} onChange={priceBook.select} />
      </div>
      {ref && <p className="mt-3 text-[13px] font-bold text-[#16a34a]">{order ? "Đặt hàng" : "Hóa đơn từ đơn"} / <DocCodeLink code={ref.code} newTab className="font-medium" /></p>}
      <div className="mt-4 min-h-0 flex-1 space-y-1 overflow-y-auto border-t border-dashed border-[#d6d9de] pt-3">
        <SummaryRow label="Tổng tiền hàng" sub={formatNumber(t.quantity)}>{formatMoney(t.subtotal)}</SummaryRow>
        <SummaryRow label={draft.discountPercent != null ? `Giảm giá (${formatNumber(draft.discountPercent)}%)` : "Giảm giá"}>
          <NumberInput aria-label="Giảm giá hóa đơn" className={`${underlineInput} w-[104px] text-[15px]`} value={t.discount}
            onValueChange={(discount) => update({ discount, discountPercent: null })} />
        </SummaryRow>
        <SummaryRow label="Khách cần trả" bold><span className="text-[17px] text-primary">{formatMoney(t.total)}</span></SummaryRow>
        {t.deposit > 0 && <SummaryRow label={order ? "Khách đã trả" : "Đã đặt cọc"}>{formatMoney(t.deposit)}</SummaryRow>}
        <SalePaidSection draft={draft} paid={t.paid} due={t.due} update={update} onQr={() => { update({ paymentMethod: "TRANSFER", extraPayments: [] }); setQr(true); }}
          allowMixed={!order && !draft.editOf} suggest={settings.suggestPaid && !order && !delivery} />
        {change > 0 && <SummaryRow label="Tiền thừa trả khách">{formatMoney(change)}</SummaryRow>}
        {change < 0 && !order && !delivery && <div className="text-destructive"><SummaryRow label="Tính vào công nợ">{formatMoney(-change)}</SummaryRow></div>}
        {delivery && <SummaryRow bold label="Thu hộ (COD)"><span className="text-primary">{formatMoney(t.cod)}</span></SummaryRow>}
        {change < 0 && order && <SummaryRow label="Còn phải trả khi nhận hàng">{formatMoney(-change)}</SummaryRow>}
        {order && <SummaryRow label="Thời gian giao hàng">
          <DateTimePicker aria-label="Thời gian giao hàng" className={`${underlineInput} w-[180px]`}
            value={draft.expectedDeliveryAt ?? ""} onChange={(v) => update({ expectedDeliveryAt: v || null })} />
        </SummaryRow>}
      </div>
      <Button title="F9" className="mt-3 h-12 w-full shrink-0 rounded-md bg-chrome text-[15px] font-bold uppercase hover:bg-chrome-hover" disabled={paying || !draft.lines.length} onClick={onPay}>
        {paying ? "Đang lưu..." : order ? (draft.orderOf ? "Lưu đơn" : "Đặt hàng") : "Thanh toán"}
      </Button>
      {qr && <QrPaymentDialog amount={t.paid} info={draft.editOf?.code ?? ref?.code ?? draft.label} onClose={() => setQr(false)}
        onPaid={draft.editOf ? undefined : (paid) => {
          update({ paid, paymentMethod: "TRANSFER", extraPayments: [] });
          if (settings.autoCompleteQr) setAutoPay(true);
        }} />}
    </div>
  );
}
