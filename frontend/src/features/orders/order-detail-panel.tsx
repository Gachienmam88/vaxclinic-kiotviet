"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { CircleCheck, FileOutput, Pencil, ReceiptText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DocCodeLink } from "@/components/ui/doc-code-link";
import { DetailTabsList } from "@/components/ui/detail-tabs-list";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { InvoiceLinesTable } from "@/features/sales/invoice-detail-sections";
import { DETAIL_BTN, DETAIL_PANEL, DETAIL_TAB, DETAIL_TABS_LIST, StatusBadge } from "@/features/sales/invoice-list-kit";
import { downloadCsv } from "@/features/sales/invoice-list-pager";
import { SALES_KEYS } from "@/features/sales/sales-queries";
import { useBranches } from "@/features/settings/settings-queries";
import { api, errorMessage } from "@/lib/api-client";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { useCurrentUser } from "@/lib/use-current-user";
import { cn } from "@/lib/utils";
import { OrderCancelDialog } from "./order-cancel-dialog";
import { OrderPaymentHistory, OrderTotals } from "./order-detail-sections";
import { useOrder } from "./order-queries";
import { ORDER_STATUS_TONE, orderStatusLabel } from "./order-types";

/**
 * Chi tiết đơn đặt hàng mở dưới dòng: Thông tin + Lịch sử thanh toán.
 * Nút: Tạo hóa đơn (mở màn bán hàng, trừ kho khi thanh toán), Chỉnh sửa (màn bán hàng), Xác nhận,
 * Hủy (hoàn cọc hoặc giữ cọc làm công nợ), Xuất file.
 */
export function OrderDetailPanel({ id, onClose }: { id: string; onClose?: () => void }) {
  const qc = useQueryClient();
  const { can } = useCurrentUser();
  const { data: o } = useOrder(id);
  const { data: branches = [] } = useBranches();
  const [cancelling, setCancelling] = useState(false);
  const refresh = () => SALES_KEYS.forEach((k) => qc.invalidateQueries({ queryKey: k }));

  const confirmOrder = useMutation({
    mutationFn: () => api(`/orders/${id}/confirm`, { method: "POST" }),
    onSuccess: () => { toast.success("Đã xác nhận đơn đặt hàng"); refresh(); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (!o) return <div className={cn(DETAIL_PANEL, "p-6 text-muted-foreground")}>Đang tải...</div>;
  const open = o.status === "DRAFT" || o.status === "CONFIRMED";
  const creditKept = o.status === "CANCELLED" && Number(o.deposit) > 0; // hủy đơn giữ cọc làm công nợ
  const exportLines = () => downloadCsv(`dat-hang-${o.code}`, ["Mã hàng", "Tên hàng", "ĐVT", "Số lượng", "Đơn giá", "Giảm giá", "Giá bán", "Thành tiền"],
    o.lines.map((l) => [l.productCode, l.productName, l.unitName, formatNumber(l.quantity), l.unitPrice, l.discount, l.price, l.amount]));
  const info = "flex h-[30px] items-center gap-2";

  return (
    <div className={DETAIL_PANEL}>
      <Tabs defaultValue="info" className="gap-0">
        <DetailTabsList onActiveTabClick={onClose} variant="line" className={DETAIL_TABS_LIST}>
          <TabsTrigger value="info" className={DETAIL_TAB}>Thông tin</TabsTrigger>
          <TabsTrigger value="payments" className={DETAIL_TAB}>Lịch sử thanh toán</TabsTrigger>
        </DetailTabsList>
        <TabsContent value="info">
          <div className="space-y-4 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-base font-bold">{o.customerCode && <><DocCodeLink code={o.customerCode} kind="/customers" /> - </>}{o.customerName}</span>
              <span>{o.code}</span>
              <StatusBadge tone={ORDER_STATUS_TONE[o.status]}>{orderStatusLabel(o.status)}</StatusBadge>
              {o.invoiceCode && <StatusBadge tone="blue">Hóa đơn <DocCodeLink code={o.invoiceCode} kind="/invoices" /></StatusBadge>}
              {creditKept && <StatusBadge tone="gray">Cọc {formatMoney(o.deposit)} giữ làm công nợ</StatusBadge>}
              <span className="ml-auto">{branches.find((b) => b.id === o.branchId)?.name}</span>
            </div>
            <div className="grid grid-cols-1 gap-x-8 gap-y-2 text-xs md:grid-cols-3">
              <div className={info}><span className="w-20 shrink-0">Người tạo:</span>{o.createdByName}</div>
              <div className={info}><span className="w-20 shrink-0">Người bán:</span>{o.sellerName}</div>
              <div className={info}><span className="w-20 shrink-0">Ngày đặt:</span>{formatDateTime(o.orderedAt)}</div>
            </div>
            <InvoiceLinesTable inv={o} />
            <div className="flex flex-col-reverse gap-4 md:flex-row md:items-start">
              <p className="mt-6 min-h-12 w-full max-w-[750px] rounded-md border px-3 py-2 text-muted-foreground">{o.note || "Chưa có ghi chú"}</p>
              <div className="md:ml-auto"><OrderTotals order={o} /></div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t px-4 py-2.5">
            {open && can("sales.cancel") && (
              <Button variant="ghost" className={DETAIL_BTN} onClick={() => setCancelling(true)}><Trash2 className="size-4" /> Hủy</Button>)}
            <Button variant="ghost" className={DETAIL_BTN} onClick={exportLines}><FileOutput className="size-4" /> Xuất file</Button>
            {open && can("sales.perform") && <>
              <Button className={cn(DETAIL_BTN, "ml-auto")} render={<Link href={`/sale?orderInvoice=${o.id}`} />}><ReceiptText className="size-4" /> Tạo hóa đơn</Button>
              <Button variant="outline" className={DETAIL_BTN} render={<Link href={`/sale?order=${o.id}`} />}><Pencil className="size-4" /> Chỉnh sửa</Button>
              {o.status === "DRAFT" && (
                <Button variant="outline" className={DETAIL_BTN} disabled={confirmOrder.isPending} onClick={() => confirmOrder.mutate()}>
                  <CircleCheck className="size-4" /> Xác nhận</Button>)}
            </>}
          </div>
        </TabsContent>
        <TabsContent value="payments"><OrderPaymentHistory order={o} /></TabsContent>
      </Tabs>
      {cancelling && <OrderCancelDialog order={o} onClose={() => setCancelling(false)} />}
    </div>
  );
}
