"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DetailTabsList } from "@/components/ui/detail-tabs-list";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { InvoiceDeliveryHistory } from "@/features/delivery/invoice-delivery-history";
import { InvoiceShipmentInfo } from "@/features/delivery/invoice-shipment-info";
import { useEInvoiceRecords } from "@/features/integrations/integration-queries";
import { fromLocalInput, toLocalInput } from "@/features/purchases/purchase-line-form";
import { useUserLookup } from "@/features/purchases/purchase-queries";
import { api, errorMessage } from "@/lib/api-client";
import { InvoiceCancelPaymentsDialog } from "@/features/orders/invoice-cancel-payments-dialog";
import { useT } from "@/lib/i18n";
import { useCurrentUser } from "@/lib/use-current-user";
import { cn } from "@/lib/utils";
import { commonNs } from "@/messages/common";
import { salesNs } from "@/messages/sales";
import { InvoiceDetailFooter } from "./invoice-detail-footer";
import { InvoiceDetailHeader, type InvoiceInfoDraft } from "./invoice-detail-header";
import { InvoiceLinesTable, InvoicePaymentHistory, InvoiceTotals } from "./invoice-detail-sections";
import { InvoiceEInvoiceCard } from "./invoice-einvoice-card";
import { InvoicePrescriptionInfo } from "./invoice-prescription-info";
import { invoiceState } from "./invoice-filter-model";
import { DETAIL_PANEL, DETAIL_TAB, DETAIL_TABS_LIST } from "./invoice-list-kit";
import { InvoiceTaxDialog } from "./invoice-tax-dialog";
import { SALES_KEYS, useInvoice } from "./sales-queries";

/**
 * Chi tiết hóa đơn mở dưới dòng (KiotViet): tab Thông tin (sửa người bán / ngày bán / kênh bán / ghi chú → Lưu,
 * thẻ Hoá đơn điện tử, thanh "Tự giao đến…", dòng hàng, tổng) + tab Lịch sử giao hàng (hóa đơn có vận đơn) + tab Lịch sử thanh toán. Bấm lại tab đang mở = thu gọn.
 */
export function InvoiceDetailPanel({ id, onClose }: { id: string; onClose?: () => void }) {
  const t = useT(salesNs);
  const tc = useT(commonNs);
  const qc = useQueryClient();
  const { can } = useCurrentUser();
  const { data: inv } = useInvoice(id);
  const { data: users = [] } = useUserLookup();
  const [edit, setEdit] = useState<InvoiceInfoDraft | null>(null);
  const [taxDialog, setTaxDialog] = useState(false);
  const [askPayments, setAskPayments] = useState(false); // hóa đơn từ đơn đặt hàng: hỏi hủy phiếu thu cọc
  const { data: einvoices = [] } = useEInvoiceRecords([id]);
  const published = einvoices[0]?.status === "PUBLISHED";
  const refresh = () => SALES_KEYS.forEach((k) => qc.invalidateQueries({ queryKey: k }));

  const save = useMutation({
    mutationFn: () => {
      const timeChanged = edit!.at !== toLocalInput(inv!.soldAt);
      return api(`/invoices/${id}/info`, { method: "PATCH", body: { sellerId: edit!.sellerId || null,
        sellerName: users.find((u) => u.id === edit!.sellerId)?.fullName, soldAt: timeChanged ? fromLocalInput(edit!.at) : null,
        note: edit!.note, salesChannel: edit!.channel } });
    },
    onSuccess: () => { toast.success(t("invoices.detail.saved")); setEdit(null); refresh(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const cancel = useMutation({
    mutationFn: (cancelPayments: boolean) => api(`/invoices/${id}/cancel?cancelPayments=${cancelPayments}`, { method: "POST" }),
    onSuccess: () => { toast.success(t("invoices.detail.cancelled")); setAskPayments(false); refresh(); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (!inv) return <div className={cn(DETAIL_PANEL, "p-6 text-muted-foreground")}>{tc("status.loading")}</div>;
  const f: InvoiceInfoDraft = edit ?? { sellerId: inv.sellerId ?? "", at: toLocalInput(inv.soldAt), channel: inv.salesChannel ?? "DIRECT", note: inv.note ?? "" };
  const set = (p: Partial<InvoiceInfoDraft>) => setEdit({ ...f, ...p });
  const active = inv.status === "COMPLETED";
  const shipmentId = inv.shipment?.id ?? null;

  return (
    <div className={DETAIL_PANEL}>
      <Tabs defaultValue="info" className="gap-0">
        <DetailTabsList onActiveTabClick={onClose} variant="line" className={DETAIL_TABS_LIST}>
          <TabsTrigger value="info" className={DETAIL_TAB}>{tc("detailTabs.info")}</TabsTrigger>
          {shipmentId && <TabsTrigger value="delivery" className={DETAIL_TAB}>{t("invoices.detail.tabDelivery")}</TabsTrigger>}
          <TabsTrigger value="payments" className={DETAIL_TAB}>{t("invoices.detail.tabPayments")}</TabsTrigger>
        </DetailTabsList>
        <TabsContent value="info">
          <div className="space-y-4 p-4">
            <InvoiceDetailHeader inv={inv} state={invoiceState(inv.status, inv.shipment?.status)} f={f} set={set} editable={active} />
            <InvoiceEInvoiceCard inv={inv} active={active} />
            <InvoiceShipmentInfo inv={inv} withMeta={false} />
            <InvoicePrescriptionInfo inv={inv} />
            <InvoiceLinesTable inv={inv} />
            <div className="flex flex-col-reverse gap-4 md:flex-row md:items-start">
              <textarea className="mt-6 min-h-24 w-full max-w-[750px] rounded-md border px-3 py-2 outline-none placeholder:text-muted-foreground focus-visible:border-primary disabled:bg-muted/40"
                placeholder={t("invoices.detail.notePlaceholder")} aria-label={tc("fields.note")} value={f.note} disabled={!active} onChange={(e) => set({ note: e.target.value })} />
              <div className="md:ml-auto"><InvoiceTotals inv={inv} /></div>
            </div>
          </div>
          <InvoiceDetailFooter inv={inv} active={active} canCancel={can("sales.cancel")} cancelling={cancel.isPending} onCancel={() => (inv.orderId && inv.payments.some((p) => p.status === "PAID") ? setAskPayments(true) : cancel.mutate(false))}
            dirty={!!edit} saving={save.isPending} onSave={() => save.mutate()} published={published} onEditTax={() => setTaxDialog(true)} />
          {taxDialog && <InvoiceTaxDialog invoice={inv} onClose={() => setTaxDialog(false)} />}
        </TabsContent>
        {shipmentId && <TabsContent value="delivery"><InvoiceDeliveryHistory shipmentId={shipmentId} /></TabsContent>}
        <TabsContent value="payments"><InvoicePaymentHistory inv={inv} /></TabsContent>
      </Tabs>
      {askPayments && <InvoiceCancelPaymentsDialog busy={cancel.isPending} onChoose={(c) => cancel.mutate(c)} onClose={() => setAskPayments(false)} />}
    </div>
  );
}
