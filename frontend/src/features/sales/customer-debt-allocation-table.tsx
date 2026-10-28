"use client";

import { NumberInput } from "@/components/number-input";
import { DocCodeLink } from "@/components/ui/doc-code-link";
import { formatDateTime, formatMoney } from "@/lib/format";
import { kvSubHead, kvSubRow, kvSubTable } from "./customer-ui-primitives";
import type { InvoiceListItem } from "./sales-types";
import { useT } from "@/lib/i18n";
import { customersNs } from "@/messages/customers";

type Props = {
  unpaid: InvoiceListItem[] | undefined; alloc: Record<string, number>; unallocated: number;
  onChange: (invoiceId: string, value: number) => void;
};

/** Bảng "Phân bổ vào hóa đơn" trong popup Thanh toán / Chiết khấu thanh toán. */
export function CustomerDebtAllocationTable({ unpaid, alloc, unallocated, onChange }: Props) {
  const t = useT(customersNs);
  return (
    <div>
      <table className={kvSubTable}>
        <thead className={kvSubHead}><tr>
          <th>{t("allocation.cols.code")}</th><th>{t("allocation.cols.time")}</th><th className="text-right">{t("allocation.cols.invoiceValue")}</th>
          <th className="text-right">{t("allocation.cols.paidBefore")}</th><th className="text-right">{t("allocation.cols.remaining")}</th>
          <th className="w-36 text-right">{t("allocation.cols.collect")}</th>
        </tr></thead>
        <tbody>
          {!unpaid?.length && <tr className={kvSubRow}><td colSpan={6} className="text-center text-muted-foreground">{t("allocation.empty")}</td></tr>}
          {unpaid?.map((i) => (
            <tr key={i.id} className={kvSubRow}>
              <td><DocCodeLink code={i.code} kind="/invoices" newTab /></td><td>{formatDateTime(i.soldAt)}</td>
              <td className="text-right">{formatMoney(i.total)}</td><td className="text-right">{formatMoney(i.paid)}</td>
              <td className="text-right">{formatMoney(i.total - i.paid)}</td>
              <td><NumberInput className="h-7 rounded-md text-[13px] md:text-[13px]" aria-label={t("allocation.collectAria", { code: i.code })} value={alloc[i.id] ?? 0}
                onValueChange={(v) => onChange(i.id, Math.min(v, i.total - i.paid))} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex justify-end gap-16 pr-2 text-[13px]">
        <span>{t("allocation.unallocated")}</span><b>{formatMoney(unallocated)}</b>
      </div>
    </div>
  );
}
