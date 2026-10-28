"use client";

import { NumberInput } from "@/components/number-input";
import { DocCodeLink } from "@/components/ui/doc-code-link";
import { formatDateTime, formatMoney } from "@/lib/format";
import { kvSubHead, kvSubRow, kvSubTable } from "./customer-ui-primitives";
import type { InvoiceListItem } from "./sales-types";

type Props = {
  unpaid: InvoiceListItem[] | undefined; alloc: Record<string, number>; unallocated: number;
  onChange: (invoiceId: string, value: number) => void;
};

/** Bảng "Phân bổ vào hóa đơn" trong popup Thanh toán / Chiết khấu thanh toán. */
export function CustomerDebtAllocationTable({ unpaid, alloc, unallocated, onChange }: Props) {
  return (
    <div>
      <table className={kvSubTable}>
        <thead className={kvSubHead}><tr>
          <th>Mã hóa đơn</th><th>Thời gian</th><th className="text-right">Giá trị hóa đơn</th>
          <th className="text-right">Đã thu trước</th><th className="text-right">Còn cần thu</th><th className="w-36 text-right">Tiền thu</th>
        </tr></thead>
        <tbody>
          {!unpaid?.length && <tr className={kvSubRow}><td colSpan={6} className="text-center text-muted-foreground">Không tìm thấy bản ghi nào phù hợp</td></tr>}
          {unpaid?.map((i) => (
            <tr key={i.id} className={kvSubRow}>
              <td><DocCodeLink code={i.code} kind="/invoices" newTab /></td><td>{formatDateTime(i.soldAt)}</td>
              <td className="text-right">{formatMoney(i.total)}</td><td className="text-right">{formatMoney(i.paid)}</td>
              <td className="text-right">{formatMoney(i.total - i.paid)}</td>
              <td><NumberInput className="h-7 rounded-md text-[13px] md:text-[13px]" aria-label={`Tiền thu ${i.code}`} value={alloc[i.id] ?? 0}
                onValueChange={(v) => onChange(i.id, Math.min(v, i.total - i.paid))} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex justify-end gap-16 pr-2 text-[13px]">
        <span>Tiền chưa phân bổ:</span><b>{formatMoney(unallocated)}</b>
      </div>
    </div>
  );
}
