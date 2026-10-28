"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DETAIL_BTN, DETAIL_PANEL, DETAIL_TAB, DETAIL_TABS_LIST, StatusBadge, SUB_HEAD } from "@/features/sales/invoice-list-kit";
import { SALES_KEYS } from "@/features/sales/sales-queries";
import { api, errorMessage } from "@/lib/api-client";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { useCurrentUser } from "@/lib/use-current-user";
import { cn } from "@/lib/utils";
import { salesReturnData } from "@/features/print/print-data";
import { PrintButton } from "@/features/print/print-button";

export type SalesReturnItem = { id: string; code: string; returnedAt: string; invoiceCode: string; customerName: string; subtotal: number;
  fee: number; total: number; refunded: number; status: "COMPLETED" | "CANCELLED" };
type Detail = SalesReturnItem & { createdByName: string; discount: number; note: string | null;
  lines: { id: string; productCode: string; productName: string; unitName: string; quantity: number; unitPrice: number; amount: number; lots: string | null }[] };

/** Chi tiết phiếu khách trả hàng mở dưới dòng (bố cục giống chi tiết hóa đơn). */
export function SalesReturnDetailPanel({ id }: { id: string }) {
  const qc = useQueryClient();
  const { can } = useCurrentUser();
  const { data: r } = useQuery({ queryKey: ["sales-return", id], queryFn: () => api<Detail>(`/sales-returns/${id}`) });
  const cancel = useMutation({
    mutationFn: () => api(`/sales-returns/${id}/cancel`, { method: "POST" }),
    onSuccess: () => { toast.success("Đã hủy phiếu trả hàng"); [...SALES_KEYS, ["sales-returns"], ["sales-return"]].forEach((k) => qc.invalidateQueries({ queryKey: k })); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (!r) return <div className={cn(DETAIL_PANEL, "p-6 text-muted-foreground")}>Đang tải...</div>;
  const done = r.status === "COMPLETED";
  const totals = [["Tổng tiền hàng trả", r.subtotal], ["Giảm giá", r.discount], ["Phí trả hàng", r.fee], ["Cần trả khách", r.total]] as const;
  return (
    <div className={DETAIL_PANEL}>
      <Tabs defaultValue="info" className="gap-0">
        <TabsList variant="line" className={DETAIL_TABS_LIST}><TabsTrigger value="info" className={DETAIL_TAB}>Thông tin</TabsTrigger></TabsList>
        <TabsContent value="info">
          <div className="space-y-4 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-base font-bold">{r.customerName}</span><span>{r.code}</span>
              <StatusBadge tone={done ? "green" : "red"}>{done ? "Đã trả" : "Đã hủy"}</StatusBadge>
            </div>
            <div className="grid grid-cols-1 gap-x-8 gap-y-2 text-xs md:grid-cols-3">
              <div><span className="inline-block w-24">Người tạo:</span>{r.createdByName}</div>
              <div><span className="inline-block w-24">Thời gian:</span>{formatDateTime(r.returnedAt)}</div>
              <div><span className="inline-block w-24">Mã hóa đơn:</span><span className="text-primary">{r.invoiceCode}</span></div>
            </div>
            <table className="w-full text-[13px]">
              <thead className={SUB_HEAD}><tr><th className="pl-2.5">Mã hàng</th><th>Tên hàng</th><th>Lô nhập lại</th>
                <th className="text-right">Số lượng</th><th className="text-right">Giá trả</th><th className="pr-2.5 text-right">Thành tiền</th></tr></thead>
              <tbody>{r.lines.map((l) => (
                <tr key={l.id} className="border-b border-[#eff0f3] [&_td]:px-2 [&_td]:py-2.5">
                  <td className="text-primary">{l.productCode}</td><td>{l.productName} ({l.unitName})</td><td>{l.lots}</td>
                  <td className="text-right">{formatNumber(l.quantity)}</td><td className="text-right">{formatMoney(l.unitPrice)}</td>
                  <td className="text-right font-bold">{formatMoney(l.amount)}</td></tr>))}</tbody>
            </table>
            <div className="flex flex-col-reverse gap-4 md:flex-row md:items-start">
              <p className="text-muted-foreground">{r.note || "Chưa có ghi chú"}</p>
              <div className="w-[260px] shrink-0 space-y-2.5 md:ml-auto">
                {totals.map(([k, v]) => <div key={k} className="grid grid-cols-[1fr_100px] gap-4 text-right"><span>{k}</span><span>{formatMoney(v)}</span></div>)}
                <div className="grid grid-cols-[1fr_100px] gap-4 text-right"><span>Đã trả khách</span><b>{formatMoney(r.refunded)}</b></div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 border-t px-4 py-2.5">
            {done && can("sales.cancel") && (
              <Button variant="ghost" className={DETAIL_BTN} disabled={cancel.isPending}
                onClick={() => confirm(`Hủy phiếu ${r.code}? Hàng sẽ bị xuất lại khỏi kho.`) && cancel.mutate()}><Trash2 className="size-4" /> Hủy</Button>)}
            <span className="ml-auto"><PrintButton type="SALES_RETURN" data={salesReturnData(r)} /></span>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
