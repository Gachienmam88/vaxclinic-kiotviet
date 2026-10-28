"use client";

import { Info } from "lucide-react";
import { NumberInput } from "@/components/number-input";
import { DOC_CODE_LINK_CLASS } from "@/components/ui/doc-code-link";
import { ListEmptyState } from "@/components/ui/list-empty-state";
import { kvSubHead, kvSubRow, kvSubTable } from "@/features/sales/customer-ui-primitives";
import { formatDateTime, formatMoney } from "@/lib/format";
import { sumAllocation, type Allocation } from "./supplier-allocation-math";
import type { UnpaidReceipt } from "./supplier-types";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { purchasesNs } from "@/messages/purchases";

type Props = {
  kind: "payment" | "discount"; receipts: UnpaidReceipt[] | undefined; alloc: Allocation; unallocated: number;
  onRow: (r: UnpaidReceipt, value: number) => void; onOpen: (receiptId: string) => void;
};

/**
 * Bảng phân bổ trong popup Thanh toán ("Tiền trả") / Chiết khấu thanh toán ("Chiết khấu phân bổ"):
 * dòng tổng ở đầu, mỗi dòng nhập tối đa "Còn cần trả", cột "Còn nợ" = còn cần trả − phân bổ.
 */
export function SupplierAllocationTable({ kind, receipts, alloc, unallocated, onRow, onOpen }: Props) {
  const pay = kind === "payment";
  const t = useT(purchasesNs);
  const tc = useT(commonNs);
  const rows = receipts ?? [];
  const sum = (f: (r: UnpaidReceipt) => number) => rows.reduce((s, r) => s + f(r), 0);
  const allocated = sumAllocation(alloc);
  const remaining = sum((r) => r.remaining);
  return (
    <div>
      <table className={kvSubTable}>
        <thead className={kvSubHead}><tr>
          <th>{pay ? t("suppliers.alloc.invoiceCode") : t("receipts.cols.code")}</th><th>{t("receipts.cols.time")}</th>
          <th className="text-right">{t("suppliers.alloc.receiptValue")}</th>
          {pay && <th className="text-right">{t("suppliers.alloc.paidBefore")}</th>}
          <th className="text-right"><span className="inline-flex items-center gap-1">{t("suppliers.alloc.remaining")}
            <span title={t("suppliers.alloc.remainingHint")}><Info className="size-3.5" /></span></span></th>
          <th className="w-36 text-right">{pay ? t("suppliers.alloc.payAmount") : t("suppliers.alloc.discountAlloc")}</th>
          <th className="text-right">{t("suppliers.alloc.stillOwed")}</th>
        </tr></thead>
        <tbody>
          {rows.length > 0 && (
            <tr className={`${kvSubRow} font-bold`}>
              <td colSpan={pay ? 4 : 3} /><td className="text-right">{formatMoney(remaining)}</td>
              <td className="text-right">{formatMoney(allocated)}</td><td className="text-right">{formatMoney(remaining - allocated)}</td>
            </tr>
          )}
          {!receipts && <tr className={kvSubRow}><td colSpan={7} className="text-center text-muted-foreground">{tc("status.loading")}</td></tr>}
          {receipts && !rows.length && <tr><td colSpan={7}><ListEmptyState compact what={t("suppliers.alloc.emptyWhat")} /></td></tr>}
          {rows.map((r) => (
            <tr key={r.id} className={kvSubRow}>
              <td><button type="button" className={DOC_CODE_LINK_CLASS} onClick={() => onOpen(r.id)}>{r.code}</button></td>
              <td>{formatDateTime(r.receivedAt)}</td><td className="text-right">{formatMoney(r.total)}</td>
              {pay && <td className="text-right">{formatMoney(r.paidBefore)}</td>}
              <td className="text-right">{formatMoney(r.remaining)}</td>
              <td><NumberInput className="ml-auto h-7 w-32 rounded-md text-[13px] md:text-[13px]" aria-label={t(pay ? "suppliers.alloc.rowPay" : "suppliers.alloc.rowDiscount", { code: r.code })}
                value={alloc[r.id] ?? 0} onValueChange={(v) => onRow(r, v)} /></td>
              <td className="text-right">{formatMoney(r.remaining - (alloc[r.id] ?? 0))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex justify-end gap-16 pr-2 text-[13px]">
        <span>{pay ? t("suppliers.alloc.unallocatedPay") : t("suppliers.alloc.unallocatedDiscount")}</span><b>{formatMoney(unallocated)}</b>
      </div>
    </div>
  );
}
