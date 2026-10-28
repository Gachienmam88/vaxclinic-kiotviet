"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, errorMessage } from "@/lib/api-client";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { useCurrentUser } from "@/lib/use-current-user";
import { useReturn } from "./purchase-queries";
import { RETURN_STATUS_LABEL } from "./purchase-types";

/** Chi tiết phiếu trả hàng nhập mở dưới dòng. */
export function ReturnDetailPanel({ id }: { id: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { can } = useCurrentUser();
  const { data: r } = useReturn(id);
  const cancel = useMutation({
    mutationFn: () => api(`/purchase-returns/${id}/cancel`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Đã hủy phiếu trả hàng nhập");
      qc.invalidateQueries({ queryKey: ["purchase-returns"] });
      qc.invalidateQueries({ queryKey: ["purchase-return", id] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (!r) return <div className="p-6 text-sm text-muted-foreground">Đang tải...</div>;

  const rows: [string, string][] = [
    ["Tổng tiền hàng", formatMoney(r.subtotal)], ["Giảm giá", formatMoney(r.discount)],
    ...(r.vatRate != null ? [[`VAT ${formatNumber(r.vatRate)}%`, formatMoney(r.vatAmount)] as [string, string]] : []),
    ["NCC cần trả", formatMoney(r.total)], ["NCC đã trả", formatMoney(r.refundAmount)],
  ];
  return (
    <div className="space-y-4 border-x-2 border-b-2 border-primary/40 bg-background p-4 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-lg font-bold">{r.code}</span>
        <Badge variant={r.status === "CANCELLED" ? "destructive" : r.status === "DRAFT" ? "secondary" : "default"}>
          {RETURN_STATUS_LABEL[r.status]}
        </Badge>
        <span className="text-muted-foreground">Thời gian: {formatDateTime(r.returnedAt)}</span>
        <span className="text-muted-foreground">Người tạo: {r.createdByName} · Người trả: {r.returnerName}</span>
        <span className="text-muted-foreground">NCC: <span className="text-primary">{r.supplierName ?? "—"}</span></span>
        {r.receiptCode && <span className="text-muted-foreground">Theo phiếu nhập: <span className="text-primary">{r.receiptCode}</span></span>}
      </div>
      <table className="w-full">
        <thead className="bg-muted/60 text-left"><tr>
          <th className="px-2 py-2">Mã hàng</th><th className="px-2">Tên hàng</th><th className="px-2">Lô</th>
          <th className="px-2 text-right">Số lượng</th><th className="px-2 text-right">Giá trả</th><th className="px-2 text-right">Thành tiền</th>
        </tr></thead>
        <tbody>
          {r.lines.map((l) => (
            <tr key={l.id} className="border-b">
              <td className="px-2 py-2 text-primary">{l.productCode}</td><td className="px-2 py-2">{l.productName} ({l.unitName})</td>
              <td className="px-2 py-2">{l.lotNumber}</td><td className="px-2 py-2 text-right">{formatNumber(l.quantity)}</td>
              <td className="px-2 py-2 text-right">{formatNumber(l.unitPrice)}</td>
              <td className="px-2 py-2 text-right font-semibold">{formatMoney(l.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex gap-6">
        <p className="max-w-xl whitespace-pre-wrap text-muted-foreground">{r.note}</p>
        <div className="ml-auto w-72 space-y-1.5">
          {rows.map(([k, v]) => <div key={k} className="flex justify-between"><span>{k}</span><span>{v}</span></div>)}
        </div>
      </div>
      {can("inventory.manage") && r.status !== "CANCELLED" && (
        <div className="flex gap-2 border-t pt-3">
          <Button variant="ghost" className="text-destructive" disabled={cancel.isPending}
            onClick={() => confirm(`Hủy phiếu ${r.code}?${r.status === "COMPLETED" ? " Hàng sẽ được nhập lại kho." : ""}`) && cancel.mutate()}>
            <Trash2 className="size-4" /> Hủy</Button>
          {r.status === "DRAFT" && (
            <Button className="ml-auto" onClick={() => router.push(`/purchases/returns/new?edit=${r.id}`)}>
              <ExternalLink className="size-4" /> Mở phiếu</Button>
          )}
        </div>
      )}
    </div>
  );
}
