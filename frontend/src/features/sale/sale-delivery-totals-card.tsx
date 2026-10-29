"use client";

import { Pencil } from "lucide-react";
import { NumberInput } from "@/components/number-input";
import { formatMoney, formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { saleNs } from "@/messages/sale";
import { SaleEInvoiceBox } from "./sale-einvoice-dialog";
import { SummaryRow, underlineInput } from "./sale-ui-parts";
import { cartTotals } from "./use-sale-tabs";
import type { DraftInvoice } from "./sale-types";

/**
 * Thẻ trắng đáy cột trái của Bán giao hàng (KiotViet): "Ghi chú đơn hàng" bên trái; Tổng tiền hàng (số lượng), Giảm giá,
 * Khách cần trả (đậm, màu chủ đạo), "Thông tin xuất HĐĐT · Chi tiết" bên phải.
 */
export function SaleDeliveryTotalsCard({ draft, update }: { draft: DraftInvoice; update: (p: Partial<DraftInvoice>) => void }) {
  const t = useT(saleNs);
  const totals = cartTotals(draft);
  return (
    <div className="flex shrink-0 gap-6 rounded-lg bg-background px-5 py-3 text-[13px] shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
      <label className="flex min-w-0 flex-1 items-start gap-2 pt-1.5">
        <Pencil className="mt-0.5 size-4 shrink-0 text-[#6b7280]" />
        <textarea className="h-full min-h-16 min-w-0 flex-1 resize-none bg-transparent outline-none placeholder:text-[#6b7280]"
          placeholder={t("checkout.orderNote")} aria-label={t("checkout.orderNote")} value={draft.note} onChange={(e) => update({ note: e.target.value })} />
      </label>
      <div className="w-[320px] shrink-0">
        <SummaryRow label={t("checkout.subtotal")} sub={formatNumber(totals.quantity)}>{formatMoney(totals.subtotal)}</SummaryRow>
        <SummaryRow label={draft.discountPercent != null ? t("checkout.discountPercent", { percent: formatNumber(draft.discountPercent) }) : t("checkout.discount")}>
          <NumberInput aria-label={t("checkout.invoiceDiscount")} className={`${underlineInput} w-[104px] text-right text-[15px]`} value={totals.discount}
            onValueChange={(discount) => update({ discount, discountPercent: null })} />
        </SummaryRow>
        <SummaryRow label={t("checkout.due")} bold><span className="text-[17px] text-primary">{formatMoney(totals.total)}</span></SummaryRow>
        {totals.deposit > 0 && <SummaryRow label={t("checkout.deposited")}>{formatMoney(totals.deposit)}</SummaryRow>}
        {draft.kind !== "RETURN" && <SaleEInvoiceBox plain value={draft.einvoiceBuyer} customer={draft.customer}
          onChange={(einvoiceBuyer) => update({ einvoiceBuyer })} />}
      </div>
    </div>
  );
}
