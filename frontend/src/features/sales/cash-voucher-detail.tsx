"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { NotebookPen, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DocCodeLink } from "@/components/ui/doc-code-link";
import { DetailTabsList } from "@/components/ui/detail-tabs-list";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { api, errorMessage } from "@/lib/api-client";
import { formatDateTime, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DETAIL_BTN, DETAIL_PANEL, DETAIL_TAB, DETAIL_TABS_LIST, StatusBadge, SUB_HEAD } from "./invoice-list-kit";
import { SALES_KEYS } from "./sales-queries";
import { voucherData } from "@/features/print/print-data";
import { PrintButton } from "@/features/print/print-button";
import { useT } from "@/lib/i18n";
import { renderRichText } from "@/lib/i18n/render-rich-text";
import { commonNs } from "@/messages/common";
import { cashbookNs } from "@/messages/cashbook";
import { salesNs } from "@/messages/sales";
import { enumLabel } from "./i18n-enum-label";

type Voucher = {
  id: string; code: string; voucherType: string; fund: string; category: string; amount: number; occurredAt: string;
  partnerType: string; partnerName: string | null; partnerPhone: string | null; collectorName: string | null;
  createdByName: string | null; accounting: boolean; status: string; sourceType: string; note: string | null;
};
type Detail = { voucher: Voucher; allocations: { invoiceId: string; invoiceCode: string; soldAt: string; invoiceTotal: number; amount: number }[] };

/** Phiếu tự sinh = "PC"/"PT"/"TT" + mã chứng từ gốc (+ "-n" khi nhiều phiếu): PCPN000001 → PN000001, TTHD000123-2 → HD000123. */
const sourceDocCode = (code: string) => /^(?:PC|PT|TT)((?:THN|PN|TH|HD|DH|DS)\d+)/.exec(code)?.[1] ?? null;


/** Chi tiết phiếu thu/chi mở dưới dòng Sổ quỹ. */
export function CashVoucherDetail({ id, onClose }: { id: string; onClose?: () => void }) {
  const t = useT(cashbookNs);
  const tc = useT(commonNs);
  const ts = useT(salesNs);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["cash-voucher", id], queryFn: () => api<Detail>(`/cashbook/${id}`) });
  const cancel = useMutation({
    mutationFn: () => api(`/cashbook/${id}/cancel`, { method: "POST" }),
    onSuccess: () => { toast.success(t("detail.cancelled")); [...SALES_KEYS, ["cash-voucher"]].forEach((k) => qc.invalidateQueries({ queryKey: k })); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (!data) return <div className={cn(DETAIL_PANEL, "p-6 text-muted-foreground")}>{tc("status.loading")}</div>;
  const v = data.voucher;
  const source = sourceDocCode(v.code);
  const receipt = v.voucherType === "RECEIPT";
  const auto = v.sourceType === "INVOICE" || v.sourceType === "PURCHASE" || v.sourceType === "DELIVERY";
  const fields = [[t("detail.amount"), formatMoney(v.amount)], [t(receipt ? "detail.categoryReceipt" : "detail.categoryPayment"), v.category],
    [t(receipt ? "detail.partnerTypeReceipt" : "detail.partnerTypePayment"), enumLabel(t, cashbookNs, "enums.partnerType", v.partnerType)],
    [t("detail.method"), enumLabel(ts, salesNs, "enums.fund", v.fund)]] as const;
  const linked = receipt ? (auto ? "detail.linkedReceiptAuto" : "detail.linkedReceipt") : (auto ? "detail.linkedPaymentAuto" : "detail.linkedPayment");
  const autoHint = v.sourceType === "INVOICE" ? "detail.autoHint.INVOICE" : v.sourceType === "DELIVERY" ? "detail.autoHint.DELIVERY" : "detail.autoHint.PURCHASE";
  return (
    <div className={DETAIL_PANEL}>
      <Tabs defaultValue="info" className="gap-0">
        <DetailTabsList onActiveTabClick={onClose} variant="line" className={DETAIL_TABS_LIST}><TabsTrigger value="info" className={DETAIL_TAB}>{tc("detailTabs.info")}</TabsTrigger></DetailTabsList>
        <TabsContent value="info">
          <div className="space-y-5 p-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-base font-bold">{t(receipt ? "enums.voucherType.RECEIPT" : "enums.voucherType.PAYMENT")}</span><span>{v.code}</span>
                <StatusBadge tone={v.status === "PAID" ? "green" : "red"}>{t(v.status === "PAID" ? "enums.status.PAID" : "enums.status.CANCELLED")}</StatusBadge>
                <StatusBadge tone={v.accounting ? "blue" : "red"}>{t(v.accounting ? "detail.accounting" : "detail.noAccounting")}</StatusBadge>
              </div>
              <p className="flex flex-wrap gap-x-3 divide-x text-xs [&>span]:pr-3">
                <span>{t("detail.createdBy", { name: v.createdByName ?? "" })}</span>
                <span>{t(receipt ? "detail.collectorReceipt" : "detail.collectorPayment", { name: v.collectorName ?? "" })}</span>
                <span>{t("detail.time", { time: formatDateTime(v.occurredAt) })}</span>
                {source && <span>{renderRichText(t("detail.sourceDoc"), { code: <DocCodeLink code={source} /> })}</span>}</p>
            </div>
            <div className="grid grid-cols-2 gap-x-5 gap-y-4 md:grid-cols-4">
              {fields.map(([k, val]) => (
                <div key={k} className="space-y-2 border-b pb-2"><div className="text-xs text-muted-foreground">{k}</div><div>{val}</div></div>))}
            </div>
            <div className="space-y-2"><div className="text-xs text-muted-foreground">{t(receipt ? "detail.partnerReceipt" : "detail.partnerPayment")}</div>
              <div><span className="text-primary">{v.partnerName ?? "—"}</span>{v.partnerPhone && `, ${v.partnerPhone}`}</div></div>
            {data.allocations.length > 0 && (
              <div className="rounded-lg border p-3">
                <p className="mb-2.5">{renderRichText(t(linked), { invoices: data.allocations.map((a, i) =>
                  <span key={a.invoiceId}>{i > 0 && ", "}<DocCodeLink code={a.invoiceCode} kind="/invoices" /></span>) })}</p>
                <table className="w-full">
                  <thead className={SUB_HEAD}><tr><th className="pl-2.5">{t("detail.allocCols.code")}</th><th>{t("detail.allocCols.time")}</th>
                    <th className="text-right">{t("detail.allocCols.voucherValue")}</th><th className="pr-2.5 text-right">{t("detail.allocCols.collected")}</th></tr></thead>
                  <tbody>{data.allocations.map((a) => (
                    <tr key={a.invoiceId} className="[&_td]:px-2 [&_td]:py-2.5"><td><DocCodeLink code={a.invoiceCode} kind="/invoices" /></td><td>{formatDateTime(a.soldAt)}</td>
                      <td className="text-right">{formatMoney(a.invoiceTotal)}</td><td className="text-right">{formatMoney(a.amount)}</td></tr>))}</tbody>
                </table>
              </div>
            )}
            <p className="flex items-center gap-2"><NotebookPen className="size-4 text-muted-foreground" />{v.note || t("detail.noNote")}</p>
          </div>
          {v.status === "PAID" && (
            <div className="flex flex-wrap items-center gap-2 border-t px-4 py-2.5">
              {auto
                ? <p className="text-xs text-muted-foreground">{t(autoHint)}</p>
                : <Button variant="ghost" className={DETAIL_BTN} disabled={cancel.isPending}
                    onClick={() => confirm(t("detail.confirmCancel", { code: v.code })) && cancel.mutate()}><Trash2 className="size-4" /> {t("detail.cancel")}</Button>}
              <span className="ml-auto" title={tc("legal.vietnameseOnly")}><PrintButton type={v.voucherType === "RECEIPT" ? "CASH_RECEIPT" : "CASH_PAYMENT"} data={voucherData(v)} /></span>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
