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
import { useT } from "@/lib/i18n";
import { renderRichText } from "@/lib/i18n/render-rich-text";
import { useCurrentUser } from "@/lib/use-current-user";
import { commonNs } from "@/messages/common";
import { ordersNs } from "@/messages/orders";
import { cn } from "@/lib/utils";
import { OrderCancelDialog } from "./order-cancel-dialog";
import { OrderPaymentHistory, OrderTotals } from "./order-detail-sections";
import { useOrder } from "./order-queries";
import { ORDER_STATUS_KEY, ORDER_STATUS_TONE } from "./order-types";

/**
 * Chi tiết đơn đặt hàng mở dưới dòng: Thông tin + Lịch sử thanh toán.
 * Nút: Tạo hóa đơn (mở màn bán hàng, trừ kho khi thanh toán), Chỉnh sửa (màn bán hàng), Xác nhận,
 * Hủy (hoàn cọc hoặc giữ cọc làm công nợ), Xuất file.
 */
export function OrderDetailPanel({ id, onClose }: { id: string; onClose?: () => void }) {
  const t = useT(ordersNs);
  const tc = useT(commonNs);
  const qc = useQueryClient();
  const { can } = useCurrentUser();
  const { data: o } = useOrder(id);
  const { data: branches = [] } = useBranches();
  const [cancelling, setCancelling] = useState(false);
  const refresh = () => SALES_KEYS.forEach((k) => qc.invalidateQueries({ queryKey: k }));

  const confirmOrder = useMutation({
    mutationFn: () => api(`/orders/${id}/confirm`, { method: "POST" }),
    onSuccess: () => { toast.success(t("detail.confirmed")); refresh(); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (!o) return <div className={cn(DETAIL_PANEL, "p-6 text-muted-foreground")}>{tc("status.loading")}</div>;
  const open = o.status === "DRAFT" || o.status === "CONFIRMED";
  const creditKept = o.status === "CANCELLED" && Number(o.deposit) > 0; // hủy đơn giữ cọc làm công nợ
  const exportLines = () => downloadCsv(t("csv.detailFile", { code: o.code }), (["productCode", "productName", "unit", "quantity", "unitPrice",
    "discount", "price", "amount"] as const).map((k) => t(`cols.${k}`)),
    o.lines.map((l) => [l.productCode, l.productName, l.unitName, formatNumber(l.quantity), l.unitPrice, l.discount, l.price, l.amount]));
  const info = "flex h-[30px] items-center gap-2";

  return (
    <div className={DETAIL_PANEL}>
      <Tabs defaultValue="info" className="gap-0">
        <DetailTabsList onActiveTabClick={onClose} variant="line" className={DETAIL_TABS_LIST}>
          <TabsTrigger value="info" className={DETAIL_TAB}>{t("detail.tabInfo")}</TabsTrigger>
          <TabsTrigger value="payments" className={DETAIL_TAB}>{t("detail.tabPayments")}</TabsTrigger>
        </DetailTabsList>
        <TabsContent value="info">
          <div className="space-y-4 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-base font-bold">{o.customerCode && <><DocCodeLink code={o.customerCode} kind="/customers" /> - </>}{o.customerName}</span>
              <span>{o.code}</span>
              <StatusBadge tone={ORDER_STATUS_TONE[o.status]}>{t(ORDER_STATUS_KEY[o.status])}</StatusBadge>
              {o.invoiceCode && <StatusBadge tone="blue">{renderRichText(t("detail.invoiceBadge"), { code: <DocCodeLink code={o.invoiceCode} kind="/invoices" /> })}</StatusBadge>}
              {creditKept && <StatusBadge tone="gray">{t("detail.creditKept", { amount: formatMoney(o.deposit) })}</StatusBadge>}
              <span className="ml-auto">{branches.find((b) => b.id === o.branchId)?.name}</span>
            </div>
            <div className="grid grid-cols-1 gap-x-8 gap-y-2 text-xs md:grid-cols-3">
              <div className={info}><span className="w-20 shrink-0">{t("detail.createdBy")}</span>{o.createdByName}</div>
              <div className={info}><span className="w-20 shrink-0">{t("detail.seller")}</span>{o.sellerName}</div>
              <div className={info}><span className="w-20 shrink-0">{t("detail.orderedAt")}</span>{formatDateTime(o.orderedAt)}</div>
            </div>
            <InvoiceLinesTable inv={o} />
            <div className="flex flex-col-reverse gap-4 md:flex-row md:items-start">
              <p className="mt-6 min-h-12 w-full max-w-[750px] rounded-md border px-3 py-2 text-muted-foreground">{o.note || t("detail.noNote")}</p>
              <div className="md:ml-auto"><OrderTotals order={o} /></div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t px-4 py-2.5">
            {open && can("sales.cancel") && (
              <Button variant="ghost" className={DETAIL_BTN} onClick={() => setCancelling(true)}><Trash2 className="size-4" /> {t("detail.cancel")}</Button>)}
            <Button variant="ghost" className={DETAIL_BTN} onClick={exportLines}><FileOutput className="size-4" /> {tc("actions.export")}</Button>
            {open && can("sales.perform") && <>
              <Button className={cn(DETAIL_BTN, "ml-auto")} render={<Link href={`/sale?orderInvoice=${o.id}`} />}><ReceiptText className="size-4" /> {t("detail.createInvoice")}</Button>
              <Button variant="outline" className={DETAIL_BTN} render={<Link href={`/sale?order=${o.id}`} />}><Pencil className="size-4" /> {t("detail.edit")}</Button>
              {o.status === "DRAFT" && (
                <Button variant="outline" className={DETAIL_BTN} disabled={confirmOrder.isPending} onClick={() => confirmOrder.mutate()}>
                  <CircleCheck className="size-4" /> {t("detail.confirm")}</Button>)}
            </>}
          </div>
        </TabsContent>
        <TabsContent value="payments"><OrderPaymentHistory order={o} /></TabsContent>
      </Tabs>
      {cancelling && <OrderCancelDialog order={o} onClose={() => setCancelling(false)} />}
    </div>
  );
}
