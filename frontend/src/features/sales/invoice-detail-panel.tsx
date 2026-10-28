"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/features/products/product-form-sections";
import { fromLocalInput, toLocalInput } from "@/features/purchases/purchase-line-form";
import { useUserLookup } from "@/features/purchases/purchase-queries";
import { useBranches } from "@/features/settings/settings-queries";
import { api, errorMessage } from "@/lib/api-client";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { useCurrentUser } from "@/lib/use-current-user";
import { EInvoiceStatus } from "@/features/integrations/einvoice-status";
import { SALES_KEYS, useInvoice } from "./sales-queries";
import { FUND_LABEL } from "./sales-types";

/** Chi tiết hóa đơn mở dưới dòng: Thông tin (sửa người bán / ngày bán / ghi chú, hủy) + Lịch sử thanh toán. */
export function InvoiceDetailPanel({ id }: { id: string }) {
  const qc = useQueryClient();
  const { can } = useCurrentUser();
  const { data: inv } = useInvoice(id);
  const { data: users = [] } = useUserLookup();
  const { data: branches = [] } = useBranches();
  const [edit, setEdit] = useState<{ sellerId: string; at: string; note: string } | null>(null);
  const refresh = () => SALES_KEYS.forEach((k) => qc.invalidateQueries({ queryKey: k }));

  const save = useMutation({
    mutationFn: () => api(`/invoices/${id}/info`, { method: "PATCH", body: { sellerId: edit!.sellerId,
      sellerName: users.find((u) => u.id === edit!.sellerId)?.fullName, soldAt: fromLocalInput(edit!.at), note: edit!.note } }),
    onSuccess: () => { toast.success("Đã lưu hóa đơn"); setEdit(null); refresh(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const cancel = useMutation({
    mutationFn: () => api(`/invoices/${id}/cancel`, { method: "POST" }),
    onSuccess: () => { toast.success("Đã hủy hóa đơn, hàng đã hoàn lại kho"); refresh(); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (!inv) return <div className="p-6 text-sm text-muted-foreground">Đang tải...</div>;
  const f = edit ?? { sellerId: inv.sellerId ?? "", at: toLocalInput(inv.soldAt), note: inv.note ?? "" };
  const set = (p: Partial<typeof f>) => setEdit({ ...f, ...p });
  const active = inv.status === "COMPLETED";
  const qty = inv.lines.reduce((s, l) => s + Number(l.quantity), 0);

  return (
    <div className="border-x-2 border-b-2 border-primary/40 bg-background p-4 text-sm">
      <Tabs defaultValue="info">
        <TabsList variant="line"><TabsTrigger value="info">Thông tin</TabsTrigger><TabsTrigger value="payments">Lịch sử thanh toán</TabsTrigger></TabsList>
        <TabsContent value="info" className="space-y-4 pt-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-lg font-bold">{inv.customerCode ? `${inv.customerCode} - ` : ""}{inv.customerName}</span>
            <span>{inv.code}</span>
            <Badge variant={active ? "default" : "destructive"}>{active ? "Hoàn thành" : "Đã hủy"}</Badge>
            {inv.offline && <Badge variant="outline">Bán offline</Badge>}
            <span className="ml-auto text-muted-foreground">{branches.find((b) => b.id === inv.branchId)?.name}</span>
          </div>
          <div className="grid grid-cols-1 gap-x-8 gap-y-2 md:grid-cols-3">
            <div className="flex items-center gap-2"><span className="w-20 text-muted-foreground">Người tạo:</span>{inv.createdByName}</div>
            <div className="flex items-center gap-2"><span className="w-20 text-muted-foreground">Người bán:</span>
              <NativeSelect value={f.sellerId} disabled={!active} onChange={(e) => set({ sellerId: e.target.value })}>
                {users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}</NativeSelect></div>
            <div className="flex items-center gap-2"><span className="w-20 text-muted-foreground">Ngày bán:</span>
              <Input type="datetime-local" value={f.at} disabled={!active} onChange={(e) => set({ at: e.target.value })} /></div>
          </div>
          <table className="w-full">
            <thead className="bg-muted/60 text-left"><tr><th className="px-2 py-2">Mã hàng</th><th className="px-2">Tên hàng</th>
              <th className="px-2 text-right">Số lượng</th><th className="px-2 text-right">Đơn giá</th><th className="px-2 text-right">Giảm giá</th>
              <th className="px-2 text-right">Giá bán</th><th className="px-2 text-right">Thành tiền</th></tr></thead>
            <tbody>{inv.lines.map((l) => (
              <tr key={l.id} className="border-b align-top">
                <td className="px-2 py-2 text-primary">{l.productCode}</td>
                <td className="px-2 py-2">{l.productName} ({l.unitName}){l.lots && <div className="text-xs text-muted-foreground">Lô: {l.lots}</div>}
                  {l.note && <div className="text-xs italic text-muted-foreground">{l.note}</div>}</td>
                <td className="px-2 py-2 text-right">{formatNumber(l.quantity)}</td><td className="px-2 py-2 text-right">{formatMoney(l.unitPrice)}</td>
                <td className="px-2 py-2 text-right">{Number(l.discount) ? formatMoney(l.discount) : ""}</td>
                <td className="px-2 py-2 text-right">{formatMoney(l.price)}</td><td className="px-2 py-2 text-right font-semibold">{formatMoney(l.amount)}</td>
              </tr>))}</tbody>
          </table>
          <div className="flex gap-6">
            <Textarea className="max-w-xl" placeholder="Ghi chú..." value={f.note} disabled={!active} onChange={(e) => set({ note: e.target.value })} />
            <div className="ml-auto w-72 space-y-1.5">
              {([[`Tổng tiền hàng (${formatNumber(qty)})`, inv.subtotal], ["Giảm giá hóa đơn", inv.discount], ["Khách cần trả", inv.total]] as const)
                .map(([k, v]) => <div key={k} className="flex justify-between"><span>{k}</span><span>{formatMoney(v)}</span></div>)}
              <div className="flex justify-between font-semibold"><span>Khách đã trả</span><span>{formatMoney(inv.paid)}</span></div>
            </div>
          </div>
          <div className="border-t pt-3"><EInvoiceStatus invoiceId={inv.id} active={active} /></div>
          {active && (
            <div className="flex gap-2 border-t pt-3">
              {can("sales.cancel") && (
                <Button variant="ghost" className="text-destructive" disabled={cancel.isPending}
                  onClick={() => confirm(`Hủy hóa đơn ${inv.code}? Hàng sẽ được hoàn lại kho.`) && cancel.mutate()}>
                  <Trash2 className="size-4" /> Hủy</Button>
              )}
              <Button className="ml-auto" render={<Link href={`/pos?edit=${inv.id}`} />}><Pencil className="size-4" /> Chỉnh sửa</Button>
              <Button variant="outline" disabled={!edit || save.isPending} onClick={() => save.mutate()}>
                <Save className="size-4" /> Lưu</Button>
              <Button variant="outline" render={<Link href={`/pos?return=${inv.id}`} />}><Undo2 className="size-4" /> Trả hàng</Button>
              <DropdownMenu>
                <DropdownMenuTrigger className="rounded-md border px-2 hover:bg-muted" aria-label="Thêm"><Ellipsis className="size-4" /></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem disabled={published} onClick={() => setTaxDialog(true)}>
                    Sửa tỷ lệ thuế hàng hóa{published && " (đã phát hành HĐĐT)"}</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </TabsContent>
        <TabsContent value="payments" className="pt-3">
          <table className="w-full">
            <thead className="bg-muted/60 text-left"><tr><th className="px-2 py-2">Mã phiếu</th><th className="px-2">Thời gian</th>
              <th className="px-2">Người tạo</th><th className="px-2 text-right">Giá trị phiếu</th><th className="px-2">Phương thức</th>
              <th className="px-2">Trạng thái</th><th className="px-2 text-right">Tiền thu/chi</th></tr></thead>
            <tbody>
              {!inv.payments.length && <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">Chưa có thanh toán</td></tr>}
              {inv.payments.map((p) => (
                <tr key={p.voucherId} className="border-b">
                  <td className="px-2 py-2 text-primary">{p.code}</td><td className="px-2">{formatDateTime(p.occurredAt)}</td>
                  <td className="px-2">{p.createdByName}</td><td className="px-2 text-right">{formatMoney(p.voucherAmount)}</td>
                  <td className="px-2">{FUND_LABEL[p.fund]}</td>
                  <td className="px-2"><Badge variant={p.status === "PAID" ? "default" : "destructive"}>{p.status === "PAID" ? "Đã thanh toán" : "Đã hủy"}</Badge></td>
                  <td className="px-2 text-right">{formatMoney(p.allocated)}</td>
                </tr>))}
            </tbody>
          </table>
        </TabsContent>
      </Tabs>
    </div>
  );
}
