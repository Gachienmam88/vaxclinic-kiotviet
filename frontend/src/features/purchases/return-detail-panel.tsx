"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DOC_CODE_LINK_CLASS, docCodeHref, DocCodeLink } from "@/components/ui/doc-code-link";
import { DetailSingleTab } from "@/components/ui/detail-tabs-list";
import { useBranches } from "@/features/settings/settings-queries";
import { api, errorMessage } from "@/lib/api-client";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { useCurrentUser } from "@/lib/use-current-user";
import { DocStatusBadge } from "./purchase-list-chrome";
import { useReturn } from "./purchase-queries";
import { returnStatusLabels } from "./purchase-types";
import { ReceiptViewDialog } from "./receipt-view-dialog";
import { purchaseReturnData } from "@/features/print/print-data";
import { PrintButton } from "@/features/print/print-button";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { purchasesNs } from "@/messages/purchases";

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-[26px] items-center gap-2 text-xs">
      <span className="w-[95px] shrink-0">{label}:</span><div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/** Chi tiết phiếu trả hàng nhập mở dưới dòng (viền xanh, tab "Thông tin", bảng hàng nền #eff0f3). */
export function ReturnDetailPanel({ id, onClose }: { id: string; onClose?: () => void }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { can } = useCurrentUser();
  const { data: r } = useReturn(id);
  const { data: branches = [] } = useBranches();
  const [viewReceipt, setViewReceipt] = useState(false);
  const t = useT(purchasesNs);
  const tc = useT(commonNs);
  const cancel = useMutation({
    mutationFn: () => api(`/purchase-returns/${id}/cancel`, { method: "POST" }),
    onSuccess: () => {
      toast.success(t("detail.toastReturnCancelled"));
      qc.invalidateQueries({ queryKey: ["purchase-returns"] });
      qc.invalidateQueries({ queryKey: ["purchase-return", id] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (!r) return <div className="border border-primary bg-background p-6 text-sm text-muted-foreground">{tc("status.loading")}</div>;

  const qty = r.lines.reduce((s, l) => s + Number(l.quantity), 0);
  const rows: [string, string][] = [
    [t("summary.itemCount"), String(r.lines.length)], [t("summary.subtotalQty", { qty: formatNumber(qty) }), formatMoney(r.subtotal)],
    [t("lines.discount"), formatMoney(r.discount)],
    ...(r.vatRate != null ? [[t("summary.vatRate", { rate: formatNumber(r.vatRate) }), formatMoney(r.vatAmount)] as [string, string]] : []),
    [t("returns.cols.supplierDue"), formatMoney(r.total)], [t("returns.cols.supplierPaid"), formatMoney(r.refundAmount)],
  ];
  return (
    <div className="border border-primary bg-background text-[13px]">
      <div className="border-b border-[#e5e7eb] px-4">
        <DetailSingleTab onClick={onClose} />
      </div>
      <div className="space-y-4 p-4">
        <div className="flex items-center gap-3">
          <span className="text-base font-bold">{r.code}</span>
          <DocStatusBadge status={r.status} label={returnStatusLabels(t)[r.status]} />
          <span className="ml-auto">{branches.find((b) => b.id === r.branchId)?.name}</span>
        </div>
        <div className="grid grid-cols-1 gap-x-8 gap-y-1.5 md:grid-cols-3">
          <Info label={tc("fields.createdBy")}>{r.createdByName}</Info>
          <Info label={t("returns.returner")}>{r.returnerName}</Info>
          <Info label={t("detail.returnDate")}>{formatDateTime(r.returnedAt)}</Info>
          <Info label={t("detail.supplierName")}><span className="block truncate" title={r.supplierName ?? ""}>{r.supplierName && r.supplierCode
            ? <DocCodeLink code={r.supplierName} to={docCodeHref(r.supplierCode) ?? undefined} /> : (r.supplierName ?? "—")}</span></Info>
          {r.receiptCode && (
            <Info label={t("returns.cols.byReceipt")}>
              {r.receiptId
                ? <button type="button" className={DOC_CODE_LINK_CLASS} onClick={() => setViewReceipt(true)}>{r.receiptCode}</button>
                : <DocCodeLink code={r.receiptCode} />}
            </Info>
          )}
        </div>
        <table className="w-full">
          <thead className="bg-[#eff0f3] text-left text-xs font-bold"><tr className="h-[30px]">
            <th className="px-2">{t("lines.productCode")}</th><th className="px-2">{t("lines.productName")}</th><th className="px-2">{t("lines.lot")}</th>
            <th className="px-2 text-right">{t("lines.quantity")}</th><th className="px-2 text-right">{t("lines.returnPrice")}</th>
            <th className="px-2 text-right">{t("lines.amount")}</th>
          </tr></thead>
          <tbody>
            {r.lines.map((l) => (
              <tr key={l.id} className="border-b border-[#e5e7eb] align-top hover:bg-[#edeef0]">
                <td className="px-2 py-2.5"><DocCodeLink code={l.productCode} /></td><td className="max-w-[260px] px-2 py-2.5">{l.productName} ({l.unitName})</td>
                <td className="px-2 py-2.5">{l.lotNumber}</td><td className="px-2 py-2.5 text-right">{formatNumber(l.quantity)}</td>
                <td className="px-2 py-2.5 text-right">{formatNumber(l.unitPrice)}</td>
                <td className="px-2 py-2.5 text-right font-bold">{formatMoney(l.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-start gap-6">
          <p className="max-w-[720px] whitespace-pre-wrap text-muted-foreground">{r.note}</p>
          <dl className="ml-auto grid w-[300px] shrink-0 grid-cols-[1fr_110px] gap-y-2.5">
            {rows.map(([k, v]) => <div key={k} className="contents"><dt className="text-right">{k}</dt><dd className="text-right">{v}</dd></div>)}
          </dl>
        </div>
      </div>
      {can("inventory.manage") && r.status !== "CANCELLED" && (
        <div className="flex flex-wrap items-center gap-1 border-t border-[#e5e7eb] px-2 py-2.5">
          <Button variant="ghost" disabled={cancel.isPending}
            onClick={() => confirm(t(r.status === "COMPLETED" ? "detail.confirmCancelReturnCompleted" : "detail.confirmCancelReturn", { code: r.code })) && cancel.mutate()}>
            <Trash2 className="size-4" /> {tc("actions.cancel")}</Button>
          <div className="ml-auto flex gap-2">
            {r.status === "DRAFT" && (
              <Button className="h-[30px] rounded-md px-3" onClick={() => router.push(`/purchases/returns/new?edit=${r.id}`)}>
                <ExternalLink className="size-4" /> {t("detail.openDoc")}</Button>
            )}
            <PrintButton type="PURCHASE_RETURN" data={purchaseReturnData(r)} branchId={r.branchId} />
          </div>
        </div>
      )}
      {viewReceipt && r.receiptId && <ReceiptViewDialog id={r.receiptId} onClose={() => setViewReceipt(false)} />}
    </div>
  );
}
