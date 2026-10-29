"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { CircleCheck, Copy, ExternalLink, FileOutput, PackageCheck, Printer, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DocCodeLink } from "@/components/ui/doc-code-link";
import { DetailTabsList } from "@/components/ui/detail-tabs-list";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { usePrinter } from "@/features/print/print-button";
import { DETAIL_BTN, DETAIL_PANEL, DETAIL_TAB, DETAIL_TABS_LIST, StatusBadge } from "@/features/sales/invoice-list-kit";
import { downloadCsv } from "@/features/sales/invoice-list-pager";
import { SALES_KEYS } from "@/features/sales/sales-queries";
import { useBranches } from "@/features/settings/settings-queries";
import { api, errorMessage } from "@/lib/api-client";
import { formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { useCurrentUser } from "@/lib/use-current-user";
import { cn } from "@/lib/utils";
import { commonNs } from "@/messages/common";
import { ordersNs } from "@/messages/orders";
import { OrderCancelDialog } from "./order-cancel-dialog";
import { OrderDetailInfoFields, orderInfoDraft, type OrderInfoDraft } from "./order-detail-info-fields";
import { OrderInvoiceHistory, OrderPaymentHistory, OrderTotals } from "./order-detail-sections";
import { OrderFinishDialog } from "./order-finish-dialog";
import { OrderLinesTable } from "./order-lines-table";
import { orderPaymentQr, orderPrintData } from "./order-print";
import { useOrder } from "./order-queries";
import { ORDER_STATUS_KEY, ORDER_STATUS_TONE, type Order } from "./order-types";

const iso = (local: string) => (local ? new Date(local).toISOString() : null);

/**
 * Chi tiết đơn đặt hàng mở dưới dòng (KiotViet): tabs Thông tin / Lịch sử thanh toán / Lịch sử hóa đơn (khi đã có hóa đơn).
 * Sửa trực tiếp người nhận đặt, ngày đặt, kênh bán, dự kiến giao, trạng thái, ghi chú → Lưu. Chân: Hủy, Sao chép, Xuất file;
 * Xử lý đơn hàng (màn bán hàng, tạo hóa đơn trừ kho), Lưu, Kết thúc, In (mẫu "Hóa đơn đặt hàng").
 */
export function OrderDetailPanel({ id, onClose }: { id: string; onClose?: () => void }) {
  const tc = useT(commonNs);
  const { data: o } = useOrder(id);
  if (!o) return <div className={cn(DETAIL_PANEL, "p-6 text-muted-foreground")}>{tc("status.loading")}</div>;
  return <OrderDetailBody key={`${o.id}-${o.status}-${o.orderedAt}`} o={o} onClose={onClose} />;
}

function OrderDetailBody({ o, onClose }: { o: Order; onClose?: () => void }) {
  const t = useT(ordersNs);
  const tc = useT(commonNs);
  const qc = useQueryClient();
  const { can } = useCurrentUser();
  const { data: branches = [] } = useBranches();
  const print = usePrinter();
  const [draft, setDraft] = useState<OrderInfoDraft>(() => orderInfoDraft(o));
  const [dialog, setDialog] = useState<"cancel" | "finish" | null>(null);
  const open = o.status === "DRAFT" || o.status === "CONFIRMED";
  const editable = o.status !== "CANCELLED" && can("sales.perform");

  const save = useMutation({
    mutationFn: () => api(`/orders/${o.id}/info`, { method: "PATCH", body: {
      sellerId: draft.sellerId || null, sellerName: null, orderedAt: iso(draft.orderedAt), salesChannel: draft.salesChannel,
      expectedDeliveryAt: iso(draft.expectedDeliveryAt), status: draft.status, note: draft.note } }),
    onSuccess: () => { toast.success(t("kv.detail.saved")); SALES_KEYS.forEach((k) => qc.invalidateQueries({ queryKey: k })); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const exportLines = () => downloadCsv(t("csv.detailFile", { code: o.code }), (["productCode", "productName", "unit", "quantity", "unitPrice",
    "discount", "price", "amount"] as const).map((k) => t(`cols.${k}`)),
    o.lines.map((l) => [l.productCode, l.productName, l.unitName, formatNumber(l.quantity), l.unitPrice, l.discount, l.price, l.amount]));
  const printOrder = async () => print("ORDER", orderPrintData(o, await orderPaymentQr(o)), o.branchId);

  return (
    <div className={DETAIL_PANEL}>
      <Tabs defaultValue="info" className="gap-0">
        <DetailTabsList onActiveTabClick={onClose} variant="line" className={DETAIL_TABS_LIST}>
          <TabsTrigger value="info" className={DETAIL_TAB}>{t("detail.tabInfo")}</TabsTrigger>
          <TabsTrigger value="payments" className={DETAIL_TAB}>{t("detail.tabPayments")}</TabsTrigger>
          {o.invoiceId && <TabsTrigger value="invoices" className={DETAIL_TAB}>{t("kv.detail.tabInvoices")}</TabsTrigger>}
        </DetailTabsList>
        <TabsContent value="info">
          <div className="space-y-4 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-base font-bold">{o.customerCode ? <DocCodeLink code={o.customerCode} kind="/customers" /> : null}
                {o.customerCode && " - "}{o.customerName}</span>
              {o.customerCode && <Link href={`/customers?code=${encodeURIComponent(o.customerCode)}`} target="_blank" aria-label={t("kv.detail.openCustomer")}
                className="text-[#2171bc] hover:text-[#1a9dcc]"><ExternalLink className="size-4" /></Link>}
              <span>{o.code}</span>
              <StatusBadge tone={ORDER_STATUS_TONE[o.status]}>{t(ORDER_STATUS_KEY[o.status])}</StatusBadge>
              {o.invoiceCode && <span className="text-[13px]">{t("kv.detail.invoice")}: <DocCodeLink code={o.invoiceCode} kind="/invoices" /></span>}
              <span className="ml-auto">{branches.find((b) => b.id === o.branchId)?.name}</span>
            </div>
            <OrderDetailInfoFields order={o} value={draft} onChange={setDraft} editable={editable} />
            <OrderLinesTable lines={o.lines} />
            <div className="flex flex-col-reverse gap-4 md:flex-row md:items-start">
              <textarea className="mt-6 min-h-16 w-full max-w-[750px] rounded-md border px-3 py-2 text-[13px] outline-none focus:border-primary disabled:bg-muted/40"
                placeholder={t("kv.detail.notePh")} aria-label={t("kv.detail.notePh")} disabled={!editable} value={draft.note}
                onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
              <div className="md:ml-auto"><OrderTotals order={o} /></div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t px-4 py-2.5">
            {open && can("sales.cancel") && <Button variant="ghost" className={DETAIL_BTN} onClick={() => setDialog("cancel")}>
              <Trash2 className="size-4" /> {t("kv.detail.cancel")}</Button>}
            {can("sales.perform") && <Button variant="ghost" className={DETAIL_BTN} render={<Link href={`/sale?copyOrder=${o.id}`} />}>
              <Copy className="size-4" /> {t("kv.detail.copy")}</Button>}
            <Button variant="ghost" className={DETAIL_BTN} onClick={exportLines}><FileOutput className="size-4" /> {tc("actions.export")}</Button>
            <span className="ml-auto" />
            {open && can("sales.perform") && <Button className={DETAIL_BTN} render={<Link href={`/sale?orderInvoice=${o.id}`} />}>
              <PackageCheck className="size-4" /> {t("kv.detail.process")}</Button>}
            {editable && <Button variant="outline" className={DETAIL_BTN} disabled={save.isPending} onClick={() => save.mutate()}>
              <Save className="size-4" /> {t("kv.detail.save")}</Button>}
            {open && can("sales.perform") && <Button variant="outline" className={DETAIL_BTN} onClick={() => setDialog("finish")}>
              <CircleCheck className="size-4" /> {t("kv.detail.finish")}</Button>}
            <Button variant="outline" className={DETAIL_BTN} onClick={() => void printOrder()}><Printer className="size-4" /> {t("kv.detail.print")}</Button>
          </div>
        </TabsContent>
        <TabsContent value="payments"><OrderPaymentHistory order={o} /></TabsContent>
        {o.invoiceId && <TabsContent value="invoices"><OrderInvoiceHistory invoiceId={o.invoiceId} /></TabsContent>}
      </Tabs>
      {dialog === "cancel" && <OrderCancelDialog order={o} onClose={() => setDialog(null)} />}
      {dialog === "finish" && <OrderFinishDialog orderId={o.id} onClose={() => setDialog(null)} />}
    </div>
  );
}
