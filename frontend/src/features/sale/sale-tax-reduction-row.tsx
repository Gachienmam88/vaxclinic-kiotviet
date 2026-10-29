"use client";

import { Info } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { formatMoney } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { saleNs } from "@/messages/sale";
import { taxReductionActive } from "./sale-tax-reduction";
import { SummaryRow } from "./sale-ui-parts";
import type { DraftInvoice } from "./sale-types";

/**
 * Dòng "Giảm thuế ⓘ [gạt]" + số tiền giảm (xanh) dưới Giảm giá (KiotViet). Chỉ hóa đơn bán, chỉ hiện trong thời gian áp dụng
 * Nghị quyết 204/2025/QH15; dòng hàng VAT10 có cờ giảm thuế tính 8% (server tính lại khi lưu).
 */
export function SaleTaxReductionRow({ draft, amount, update }: { draft: DraftInvoice; amount: number; update: (p: Partial<DraftInvoice>) => void }) {
  const t = useT(saleNs);
  if (draft.kind === "ORDER" || draft.kind === "RETURN" || !taxReductionActive()) return null;
  return (
    <SummaryRow label={<>
      {t("taxReduction.label")}
      <Info className="size-3.5 text-[#4b5563]" aria-label={t("taxReduction.tooltip")}><title>{t("taxReduction.tooltip")}</title></Info>
      <Switch className="ml-4" aria-label={t("taxReduction.label")} checked={!!draft.taxReduction}
        onCheckedChange={(on) => update({ taxReduction: on })} />
    </>}><span className="text-[#2171bc]">{formatMoney(amount)}</span></SummaryRow>
  );
}
