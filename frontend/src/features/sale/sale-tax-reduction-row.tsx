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
/** method: phương pháp server trả về (DEDUCTION / DIRECT) → ghi chú nhỏ cạnh số tiền. */
export function SaleTaxReductionRow({ draft, amount, method, update }: {
  draft: DraftInvoice; amount: number; method?: string | null; update: (p: Partial<DraftInvoice>) => void;
}) {
  const t = useT(saleNs);
  if (draft.kind === "ORDER" || draft.kind === "RETURN" || !taxReductionActive()) return null;
  return (
    <SummaryRow label={<>
      {t("taxReduction.label")}
      <span className="group relative inline-flex" tabIndex={0} aria-label={t("taxReduction.tooltip")}>
        <Info className="size-4 text-[#4b5563]" />
        <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 hidden w-44 -translate-x-1/2 rounded-md bg-popover px-3 py-2 text-center text-[12px] font-normal text-foreground shadow-lg ring-1 ring-foreground/10 group-hover:block group-focus:block">
          {t("taxReduction.tooltip")}</span>
      </span>
      <Switch className="ml-4" aria-label={t("taxReduction.label")} checked={!!draft.taxReduction}
        onCheckedChange={(on) => update({ taxReduction: on })} />
    </>}>
      {draft.taxReduction && method && <span className="mr-2 text-[11px] text-[#6b7280]">{t(`taxReduction.methods.${method === "DIRECT" ? "DIRECT" : "DEDUCTION"}`)}</span>}
      <span className="text-[#2171bc]">{formatMoney(amount)}</span></SummaryRow>
  );
}
