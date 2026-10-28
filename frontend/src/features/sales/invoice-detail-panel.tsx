"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Ellipsis, FileOutput, Pencil, Save, Trash2, Undo2 } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEInvoiceRecords } from "@/features/integrations/integration-queries";
import { InvoiceTaxDialog } from "./invoice-tax-dialog";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fromLocalInput, toLocalInput } from "@/features/purchases/purchase-line-form";
import { useUserLookup } from "@/features/purchases/purchase-queries";
import { useBranches } from "@/features/settings/settings-queries";
import { api, errorMessage } from "@/lib/api-client";
import { formatDateTime, formatNumber } from "@/lib/format";
import { useCurrentUser } from "@/lib/use-current-user";
import { cn } from "@/lib/utils";
import { EInvoiceStatus } from "@/features/integrations/einvoice-status";
import { SALES_KEYS, useInvoice } from "./sales-queries";
import { invoiceData } from "@/features/print/print-data";
import { PrintButton } from "@/features/print/print-button";
import { InvoiceLinesTable, InvoicePaymentHistory, InvoiceTotals } from "./invoice-detail-sections";
import { DETAIL_BTN, DETAIL_PANEL, DETAIL_TAB, DETAIL_TABS_LIST, StatusBadge } from "./invoice-list-kit";
import { downloadCsv } from "./invoice-list-pager";

const FIELD = "h-[30px] w-full rounded-md border bg-background px-2 text-[13px] outline-none focus-visible:border-primary disabled:bg-muted/40";

/** Chi tiết hóa đơn mở dưới dòng: Thông tin (sửa người bán / ngày bán / ghi chú, hủy) + Lịch sử thanh toán. */
export function InvoiceDetailPanel({ id }: { id: string }) {
  const qc = useQueryClient();
  const { can } = useCurrentUser();
  const { data: inv } = useInvoice(id);
  const { data: users = [] } = useUserLookup();
  const { data: branches = [] } = useBranches();
  const [edit, setEdit] = useState<{ sellerId: string; at: string; note: string } | null>(null);
  const [taxDialog, setTaxDialog] = useState(false);
  const { data: einvoices = [] } = useEInvoiceRecords([id]);
  const published = einvoices[0]?.status === "PUBLISHED";
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

  if (!inv) return <div className={cn(DETAIL_PANEL, "p-6 text-muted-foreground")}>Đang tải...</div>;
  const f = edit ?? { sellerId: inv.sellerId ?? "", at: toLocalInput(inv.soldAt), note: inv.note ?? "" };
  const set = (p: Partial<typeof f>) => setEdit({ ...f, ...p });
  const active = inv.status === "COMPLETED";
  const exportLines = () => downloadCsv(`hoa-don-${inv.code}`, ["Mã hàng", "Tên hàng", "ĐVT", "Số lượng", "Đơn giá", "Giảm giá", "Giá bán", "Thành tiền"],
    inv.lines.map((l) => [l.productCode, l.productName, l.unitName, formatNumber(l.quantity), l.unitPrice, l.discount, l.price, l.amount]));

  return (
    <div className={DETAIL_PANEL}>
      <Tabs defaultValue="info" className="gap-0">
        <TabsList variant="line" className={DETAIL_TABS_LIST}>
          <TabsTrigger value="info" className={DETAIL_TAB}>Thông tin</TabsTrigger>
          <TabsTrigger value="payments" className={DETAIL_TAB}>Lịch sử thanh toán</TabsTrigger>
        </TabsList>
        <TabsContent value="info">
          <div className="space-y-4 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-base font-bold">{inv.customerCode ? `${inv.customerCode} - ` : ""}{inv.customerName}</span>
              <span>{inv.code}</span>
              <StatusBadge tone={active ? "green" : "red"}>{active ? "Hoàn thành" : "Đã hủy"}</StatusBadge>
              {inv.offline && <StatusBadge tone="gray">Bán offline</StatusBadge>}
              <span className="ml-auto">{branches.find((b) => b.id === inv.branchId)?.name}</span>
            </div>
            <div className="grid grid-cols-1 gap-x-8 gap-y-2 text-xs md:grid-cols-3">
              <div className="flex h-[30px] items-center gap-2"><span className="w-20 shrink-0">Người tạo:</span>{inv.createdByName}</div>
              <div className="flex items-center gap-2"><span className="w-20 shrink-0">Người bán:</span>
                <select className={FIELD} aria-label="Người bán" value={f.sellerId} disabled={!active} onChange={(e) => set({ sellerId: e.target.value })}>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}</select></div>
              <div className="flex items-center gap-2"><span className="w-20 shrink-0">Ngày bán:</span>
                <input type="datetime-local" aria-label="Ngày bán" className={FIELD} value={f.at} disabled={!active} onChange={(e) => set({ at: e.target.value })} /></div>
            </div>
            <InvoiceLinesTable inv={inv} />
            <div className="flex flex-col-reverse gap-4 md:flex-row md:items-start">
              <textarea className="mt-6 min-h-24 w-full max-w-[750px] rounded-md border px-3 py-2 outline-none placeholder:text-muted-foreground focus-visible:border-primary disabled:bg-muted/40"
                placeholder="Ghi chú..." aria-label="Ghi chú" value={f.note} disabled={!active} onChange={(e) => set({ note: e.target.value })} />
              <div className="md:ml-auto"><InvoiceTotals inv={inv} /></div>
            </div>
            <EInvoiceStatus invoiceId={inv.id} active={active} />
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t px-4 py-2.5">
            {active && can("sales.cancel") && (
              <Button variant="ghost" className={DETAIL_BTN} disabled={cancel.isPending}
                onClick={() => confirm(`Hủy hóa đơn ${inv.code}? Hàng sẽ được hoàn lại kho.`) && cancel.mutate()}>
                <Trash2 className="size-4" /> Hủy</Button>)}
            <Button variant="ghost" className={DETAIL_BTN} onClick={exportLines}><FileOutput className="size-4" /> Xuất file</Button>
            {active && <>
              <Button className={cn(DETAIL_BTN, "ml-auto")} render={<Link href={`/pos?edit=${inv.id}`} />}><Pencil className="size-4" /> Chỉnh sửa</Button>
              <Button variant="outline" className={DETAIL_BTN} disabled={!edit || save.isPending} onClick={() => save.mutate()}>
                <Save className="size-4" /> Lưu</Button>
              <Button variant="outline" className={DETAIL_BTN} render={<Link href={`/pos?return=${inv.id}`} />}><Undo2 className="size-4" /> Trả hàng</Button>
            </>}
            <span className={cn(!active && "ml-auto")}><PrintButton type="INVOICE" data={invoiceData(inv)} branchId={inv.branchId} /></span>
            {active && (
              <DropdownMenu>
                <DropdownMenuTrigger className="inline-flex size-[30px] items-center justify-center rounded-md border hover:bg-muted" aria-label="Thêm thao tác">
                  <Ellipsis className="size-4" /></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem disabled={published} onClick={() => setTaxDialog(true)}>
                    Sửa tỷ lệ thuế hàng hóa{published && " (đã phát hành HĐĐT)"}</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>)}
          </div>
          {taxDialog && <InvoiceTaxDialog invoice={inv} onClose={() => setTaxDialog(false)} />}
        </TabsContent>
        <TabsContent value="payments"><InvoicePaymentHistory inv={inv} /></TabsContent>
      </Tabs>
      <p className="sr-only">Cập nhật {formatDateTime(inv.soldAt)}</p>
    </div>
  );
}
