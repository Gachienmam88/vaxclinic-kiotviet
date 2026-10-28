"use client";

import { Info } from "lucide-react";
import { NumberInput } from "@/components/number-input";
import { ListEmptyState } from "@/components/ui/list-empty-state";
import { kvSubHead, kvSubRow, kvSubTable } from "@/features/sales/customer-ui-primitives";
import { formatDateTime, formatMoney } from "@/lib/format";
import { sumAllocation, type Allocation } from "./supplier-allocation-math";
import type { UnpaidReceipt } from "./supplier-types";

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
  const rows = receipts ?? [];
  const sum = (f: (r: UnpaidReceipt) => number) => rows.reduce((s, r) => s + f(r), 0);
  const allocated = sumAllocation(alloc);
  const remaining = sum((r) => r.remaining);
  return (
    <div>
      <table className={kvSubTable}>
        <thead className={kvSubHead}><tr>
          <th>{pay ? "Mã hóa đơn" : "Mã nhập hàng"}</th><th>Thời gian</th><th className="text-right">Giá trị phiếu nhập</th>
          {pay && <th className="text-right">Đã trả trước</th>}
          <th className="text-right"><span className="inline-flex items-center gap-1">Còn cần trả
            <span title="Giá trị phiếu nhập − đã trả / đã chiết khấu trước"><Info className="size-3.5" /></span></span></th>
          <th className="w-36 text-right">{pay ? "Tiền trả" : "Chiết khấu phân bổ"}</th><th className="text-right">Còn nợ</th>
        </tr></thead>
        <tbody>
          {rows.length > 0 && (
            <tr className={`${kvSubRow} font-bold`}>
              <td colSpan={pay ? 4 : 3} /><td className="text-right">{formatMoney(remaining)}</td>
              <td className="text-right">{formatMoney(allocated)}</td><td className="text-right">{formatMoney(remaining - allocated)}</td>
            </tr>
          )}
          {!receipts && <tr className={kvSubRow}><td colSpan={7} className="text-center text-muted-foreground">Đang tải...</td></tr>}
          {receipts && !rows.length && <tr><td colSpan={7}><ListEmptyState compact what="phiếu nhập còn nợ" period="" /></td></tr>}
          {rows.map((r) => (
            <tr key={r.id} className={kvSubRow}>
              <td><button type="button" className="text-primary hover:underline" onClick={() => onOpen(r.id)}>{r.code}</button></td>
              <td>{formatDateTime(r.receivedAt)}</td><td className="text-right">{formatMoney(r.total)}</td>
              {pay && <td className="text-right">{formatMoney(r.paidBefore)}</td>}
              <td className="text-right">{formatMoney(r.remaining)}</td>
              <td><NumberInput className="ml-auto h-7 w-32 rounded-md text-[13px] md:text-[13px]" aria-label={`${pay ? "Tiền trả" : "Chiết khấu"} ${r.code}`}
                value={alloc[r.id] ?? 0} onValueChange={(v) => onRow(r, v)} /></td>
              <td className="text-right">{formatMoney(r.remaining - (alloc[r.id] ?? 0))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex justify-end gap-16 pr-2 text-[13px]">
        <span>{pay ? "Tiền chưa phân bổ:" : "Chiết khấu chưa phân bổ:"}</span><b>{formatMoney(unallocated)}</b>
      </div>
    </div>
  );
}
