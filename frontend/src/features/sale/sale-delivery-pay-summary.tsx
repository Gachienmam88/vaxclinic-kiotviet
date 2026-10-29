"use client";

import { useState } from "react";
import { QrCode } from "lucide-react";
import { NumberInput } from "@/components/number-input";
import { Switch } from "@/components/ui/switch";
import { QrPaymentDialog } from "@/features/sales/qr-payment-dialog";
import { formatMoney } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { saleNs } from "@/messages/sale";
import { deliveryOf } from "./sale-delivery-draft";
import { underlineInput } from "./sale-ui-parts";
import { cartTotals } from "./use-sale-tabs";
import type { DraftInvoice } from "./sale-types";

/**
 * Đáy khung giao hàng: "Khách thanh toán" (mã QR, F8) và "Thu hộ tiền (COD)" (gạt + số tiền đậm).
 * Bật thu hộ: khách trả trước 0 → bưu tá thu phần còn lại. Tắt: khách trả đủ ngay (sửa được; phần thiếu ghi công nợ khách).
 */
export function SaleDeliveryPaySummary({ draft, update }: { draft: DraftInvoice; update: (p: Partial<DraftInvoice>) => void }) {
  const t = useT(saleNs);
  const [qr, setQr] = useState(false);
  const totals = cartTotals(draft);
  const v = deliveryOf(draft);
  const codOn = v.codEnabled !== false;
  const toggle = (on: boolean) => update({ delivery: { ...v, codEnabled: on }, paid: on ? 0 : totals.due, extraPayments: [] });

  return (
    <div className="shrink-0 space-y-1 border-t border-[#eef0f3] pt-2">
      <div className="flex min-h-8 items-center justify-between gap-3 font-bold">
        <span className="flex items-center gap-2">{t("checkout.paid")}
          <button type="button" title={t("payment.qr")} aria-label={t("payment.qr")} className="text-[#4b5563] hover:text-primary"
            onClick={() => { update({ paymentMethod: "TRANSFER", extraPayments: [] }); setQr(true); }}><QrCode className="size-4" /></button>
        </span>
        <NumberInput aria-label={t("checkout.paid")} id="sale-paid" className={`${underlineInput} w-[104px] text-right font-normal`}
          value={totals.paid} onValueChange={(paid) => update({ paid: Math.min(paid, totals.due), extraPayments: [] })} />
      </div>
      <div className="flex min-h-8 items-center justify-between gap-3 font-bold">
        <label className="flex cursor-pointer items-center gap-3">{t("delivery.codToggle")}
          <Switch aria-label={t("delivery.codToggle")} checked={codOn} onCheckedChange={toggle} />
        </label>
        <span className="text-[17px]">{formatMoney(totals.cod)}</span>
      </div>
      {qr && <QrPaymentDialog amount={totals.paid > 0 ? totals.paid : totals.due} info={draft.editOf?.code ?? draft.label} onClose={() => setQr(false)}
        onPaid={draft.editOf ? undefined : (paid) => update({ paid: Math.min(paid, totals.due), paymentMethod: "TRANSFER", extraPayments: [] })} />}
    </div>
  );
}
