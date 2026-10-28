"use client";

import { Fragment, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { periodParams, SALES_KEYS, type Period } from "@/features/sales/sales-queries";
import { api, errorMessage } from "@/lib/api-client";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { useCurrentUser } from "@/lib/use-current-user";
import { cn } from "@/lib/utils";

type Item = { id: string; code: string; returnedAt: string; invoiceCode: string; customerName: string; subtotal: number;
  fee: number; total: number; refunded: number; status: "COMPLETED" | "CANCELLED" };
type Detail = Item & { createdByName: string; discount: number; note: string | null;
  lines: { id: string; productCode: string; productName: string; unitName: string; quantity: number; unitPrice: number; amount: number; lots: string | null }[] };

function ReturnDetail({ id }: { id: string }) {
  const qc = useQueryClient();
  const { can } = useCurrentUser();
  const { data: r } = useQuery({ queryKey: ["sales-return", id], queryFn: () => api<Detail>(`/sales-returns/${id}`) });
  const cancel = useMutation({
    mutationFn: () => api(`/sales-returns/${id}/cancel`, { method: "POST" }),
    onSuccess: () => { toast.success("Đã hủy phiếu trả hàng"); [...SALES_KEYS, ["sales-returns"], ["sales-return"]].forEach((k) => qc.invalidateQueries({ queryKey: k })); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (!r) return <div className="p-6 text-sm text-muted-foreground">Đang tải...</div>;
  return (
    <div className="space-y-3 border-x-2 border-b-2 border-primary/40 bg-background p-4 text-sm">
      <p><b className="text-lg">{r.code}</b> · theo hóa đơn <span className="text-primary">{r.invoiceCode}</span> · {r.customerName} · người tạo {r.createdByName}</p>
      <table className="w-full"><thead className="bg-muted/60 text-left"><tr><th className="px-2 py-2">Mã hàng</th><th className="px-2">Tên hàng</th>
        <th className="px-2">Lô nhập lại</th><th className="px-2 text-right">SL trả</th><th className="px-2 text-right">Giá trả</th><th className="px-2 text-right">Thành tiền</th></tr></thead>
        <tbody>{r.lines.map((l) => (
          <tr key={l.id} className="border-b"><td className="px-2 py-2 text-primary">{l.productCode}</td><td className="px-2">{l.productName} ({l.unitName})</td>
            <td className="px-2">{l.lots}</td><td className="px-2 text-right">{formatNumber(l.quantity)}</td>
            <td className="px-2 text-right">{formatMoney(l.unitPrice)}</td><td className="px-2 text-right font-semibold">{formatMoney(l.amount)}</td></tr>))}</tbody></table>
      <div className="ml-auto w-72 space-y-1">
        {([["Tổng tiền hàng trả", r.subtotal], ["Giảm giá", r.discount], ["Phí trả hàng", r.fee], ["Cần trả khách", r.total], ["Đã trả khách", r.refunded]] as const)
          .map(([k, v]) => <div key={k} className="flex justify-between"><span>{k}</span><span>{formatMoney(v)}</span></div>)}
      </div>
      {r.status === "COMPLETED" && can("sales.cancel") && (
        <Button variant="ghost" className="text-destructive" disabled={cancel.isPending}
          onClick={() => confirm(`Hủy phiếu ${r.code}? Hàng sẽ bị xuất lại khỏi kho.`) && cancel.mutate()}><Trash2 className="size-4" /> Hủy</Button>)}
    </div>
  );
}

/** Đơn hàng → Trả hàng: danh sách phiếu khách trả hàng. Tạo phiếu từ nút "Trả hàng" trong chi tiết hóa đơn. */
export default function SalesReturnsPage() {
  const [q, setQ] = useState("");
  const [period, setPeriod] = useState<Period>({ mode: "month", from: "", to: "" });
  const [expanded, setExpanded] = useState<string | null>(null);
  const params = useMemo(() => {
    const p = periodParams(period, new URLSearchParams({ size: "50" }));
    if (q) p.set("q", q);
    return p;
  }, [q, period]);
  const { data } = useQuery({
    queryKey: ["sales-returns", params.toString()],
    queryFn: () => api<{ items: Item[]; total: number; sumTotal: number }>(`/sales-returns?${params}`),
  });
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold">Trả hàng</h1>
        <Input className="ml-6 max-w-md bg-background" placeholder="Theo mã phiếu trả, mã hóa đơn, tên khách" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="h-8 rounded-md border bg-background px-2 text-sm" value={period.mode}
          onChange={(e) => setPeriod({ ...period, mode: e.target.value as Period["mode"] })}>
          <option value="month">Tháng này</option><option value="all">Toàn thời gian</option></select>
      </div>
      <div className="overflow-x-auto rounded-lg bg-background">
        <Table>
          <TableHeader><TableRow className="bg-primary/10 hover:bg-primary/10">
            <TableHead>Mã trả hàng</TableHead><TableHead>Thời gian</TableHead><TableHead>Hóa đơn</TableHead><TableHead>Khách hàng</TableHead>
            <TableHead className="text-right">Tổng tiền hàng</TableHead><TableHead className="text-right">Phí trả hàng</TableHead>
            <TableHead className="text-right">Cần trả khách</TableHead><TableHead className="text-right">Đã trả khách</TableHead><TableHead>Trạng thái</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {data && !data.items.length && <TableRow><TableCell colSpan={9} className="py-10 text-center text-muted-foreground">Không có phiếu trả hàng</TableCell></TableRow>}
            {data?.items.map((r) => (
              <Fragment key={r.id}>
                <TableRow className={cn("cursor-pointer", expanded === r.id && "bg-primary/5")} onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                  <TableCell className="font-medium">{r.code}</TableCell><TableCell>{formatDateTime(r.returnedAt)}</TableCell>
                  <TableCell>{r.invoiceCode}</TableCell><TableCell>{r.customerName}</TableCell>
                  <TableCell className="text-right">{formatMoney(r.subtotal)}</TableCell><TableCell className="text-right">{formatMoney(r.fee)}</TableCell>
                  <TableCell className="text-right">{formatMoney(r.total)}</TableCell><TableCell className="text-right">{formatMoney(r.refunded)}</TableCell>
                  <TableCell><Badge variant={r.status === "COMPLETED" ? "default" : "destructive"}>{r.status === "COMPLETED" ? "Đã trả" : "Đã hủy"}</Badge></TableCell>
                </TableRow>
                {expanded === r.id && <TableRow className="hover:bg-transparent"><TableCell colSpan={9} className="p-0 whitespace-normal"><ReturnDetail id={r.id} /></TableCell></TableRow>}
              </Fragment>))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
