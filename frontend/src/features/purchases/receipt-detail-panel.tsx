"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, ExternalLink, Save, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/features/products/product-form-sections";
import { useBranches } from "@/features/settings/settings-queries";
import { api, errorMessage } from "@/lib/api-client";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { useCurrentUser } from "@/lib/use-current-user";
import { fromLocalInput, toLocalInput } from "./purchase-line-form";
import { useReceipt, useUserLookup } from "./purchase-queries";
import { RECEIPT_STATUS_LABEL, type Receipt } from "./purchase-types";

function Summary({ r }: { r: Receipt }) {
  const qty = r.lines.reduce((s, l) => s + Number(l.quantity), 0);
  const rows: [string, string][] = [
    ["Số lượng mặt hàng", String(r.lines.length)], [`Tổng tiền hàng (${formatNumber(qty)})`, formatMoney(r.subtotal)],
    ["Giảm giá", formatMoney(r.discount)], ...(r.vatRate != null ? [[`VAT ${formatNumber(r.vatRate)}%`, formatMoney(r.vatAmount)] as [string, string]] : []),
    ["Tổng cộng", formatMoney(r.total)], ["Tiền đã trả NCC", formatMoney(r.paidAmount)],
  ];
  return (
    <div className="ml-auto w-80 space-y-1.5 text-sm">
      {rows.map(([k, v]) => <div key={k} className="flex justify-between"><span>{k}</span><span>{v}</span></div>)}
    </div>
  );
}

/** Chi tiết phiếu nhập mở ngay dưới dòng. Sửa được người nhập, ngày nhập, số HĐ, ghi chú (kể cả phiếu đã nhập). */
export function ReceiptDetailPanel({ id }: { id: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { can } = useCurrentUser();
  const { data: r } = useReceipt(id);
  const { data: users = [] } = useUserLookup();
  const { data: branches = [] } = useBranches();
  const [info, setInfo] = useState<{ at: string; receiverId: string; invoiceNo: string; note: string } | null>(null);
  const manage = can("inventory.manage");

  const refresh = () => { qc.invalidateQueries({ queryKey: ["purchase-receipts"] }); qc.invalidateQueries({ queryKey: ["purchase-receipt", id] }); };
  const saveInfo = useMutation({
    mutationFn: () => api(`/purchase-receipts/${id}/info`, { method: "PATCH", body: {
      receivedAt: fromLocalInput(info!.at), receiverId: info!.receiverId || null,
      receiverName: users.find((u) => u.id === info!.receiverId)?.fullName, inputInvoiceNo: info!.invoiceNo, note: info!.note } }),
    onSuccess: () => { toast.success("Đã lưu phiếu nhập"); refresh(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const cancel = useMutation({
    mutationFn: () => api(`/purchase-receipts/${id}/cancel`, { method: "POST" }),
    onSuccess: () => { toast.success("Đã hủy phiếu nhập"); refresh(); qc.invalidateQueries({ queryKey: ["products"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (!r) return <div className="p-6 text-sm text-muted-foreground">Đang tải...</div>;
  const f = info ?? { at: toLocalInput(r.receivedAt), receiverId: r.receiverId ?? "", invoiceNo: r.inputInvoiceNo ?? "", note: r.note ?? "" };
  const setF = (p: Partial<typeof f>) => setInfo({ ...f, ...p });
  const editable = manage && r.status !== "CANCELLED";

  return (
    <div className="space-y-4 border-x-2 border-b-2 border-primary/40 bg-background p-4 text-sm">
      <div className="flex items-center gap-3">
        <span className="text-lg font-bold">{r.code}</span>
        <Badge variant={r.status === "CANCELLED" ? "destructive" : r.status === "DRAFT" ? "secondary" : "default"}>
          {RECEIPT_STATUS_LABEL[r.status]}
        </Badge>
        <span className="ml-auto text-muted-foreground">{branches.find((b) => b.id === r.branchId)?.name}</span>
      </div>
      <div className="grid grid-cols-1 gap-x-8 gap-y-2 md:grid-cols-3">
        <div className="flex items-center gap-3"><span className="w-24 text-muted-foreground">Người tạo:</span>{r.createdByName}</div>
        <div className="flex items-center gap-3"><span className="w-24 text-muted-foreground">Người nhập:</span>
          <NativeSelect value={f.receiverId} disabled={!editable} onChange={(e) => setF({ receiverId: e.target.value })}>
            {users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
          </NativeSelect></div>
        <div className="flex items-center gap-3"><span className="w-24 text-muted-foreground">Ngày nhập:</span>
          <Input type="datetime-local" value={f.at} disabled={!editable} onChange={(e) => setF({ at: e.target.value })} /></div>
        <div className="flex items-center gap-3"><span className="w-24 text-muted-foreground">Tên NCC:</span>
          <span className="text-primary">{r.supplierName ?? "—"}</span></div>
        <div className="flex items-center gap-3"><span className="w-24 text-muted-foreground">Số HĐ đầu vào:</span>
          <Input value={f.invoiceNo} disabled={!editable} onChange={(e) => setF({ invoiceNo: e.target.value })} /></div>
      </div>
      <table className="w-full">
        <thead className="bg-muted/60 text-left"><tr>
          <th className="px-2 py-2">Mã hàng</th><th className="px-2">Tên hàng</th><th className="px-2 text-right">Số lượng</th>
          <th className="px-2 text-right">Đơn giá</th><th className="px-2 text-right">Giảm giá</th>
          <th className="px-2 text-right">Giá nhập có VAT</th><th className="px-2 text-right">Thành tiền</th>
        </tr></thead>
        <tbody>
          {r.lines.map((l) => (
            <tr key={l.id} className="border-b align-top">
              <td className="px-2 py-2 text-primary">{l.productCode}</td>
              <td className="px-2 py-2">{l.productName} ({l.unitName})
                {l.lotNumber && <div className="text-xs text-muted-foreground">Lô {l.lotNumber} · HSD {formatDate(l.expiryDate)}</div>}</td>
              <td className="px-2 py-2 text-right">{formatNumber(l.quantity)}</td>
              <td className="px-2 py-2 text-right">{formatNumber(l.unitPrice)}</td>
              <td className="px-2 py-2 text-right">{Number(l.discount) ? formatNumber(l.discount) : ""}</td>
              <td className="px-2 py-2 text-right">{formatNumber(l.priceWithVat)}</td>
              <td className="px-2 py-2 text-right font-semibold">{formatMoney(l.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex gap-6">
        <Textarea className="max-w-xl" placeholder="Ghi chú..." value={f.note} disabled={!editable} onChange={(e) => setF({ note: e.target.value })} />
        <Summary r={r} />
      </div>
      {manage && (
        <div className="flex flex-wrap items-center gap-2 border-t pt-3">
          {r.status !== "CANCELLED" && (
            <Button variant="ghost" className="text-destructive" disabled={cancel.isPending}
              onClick={() => confirm(r.status === "COMPLETED" ? `Hủy phiếu ${r.code}? Hàng sẽ bị trừ khỏi kho.` : `Hủy phiếu tạm ${r.code}?`) && cancel.mutate()}>
              <Trash2 className="size-4" /> Hủy</Button>
          )}
          <Button variant="ghost" onClick={() => router.push(`/purchases/receipts/new?copyFrom=${r.id}`)}><Copy className="size-4" /> Sao chép</Button>
          <div className="ml-auto flex gap-2">
            {r.status === "DRAFT" && (
              <Button onClick={() => router.push(`/purchases/receipts/new?edit=${r.id}`)}><ExternalLink className="size-4" /> Mở phiếu</Button>
            )}
            {editable && <Button variant="outline" disabled={!info || saveInfo.isPending} onClick={() => saveInfo.mutate()}><Save className="size-4" /> Lưu</Button>}
            {r.status === "COMPLETED" && (
              <Button variant="outline" onClick={() => router.push(`/purchases/returns/new?receiptId=${r.id}`)}><Undo2 className="size-4" /> Trả hàng nhập</Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
