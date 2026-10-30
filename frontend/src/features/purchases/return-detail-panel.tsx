"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, Ellipsis, ExternalLink, FileOutput, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DOC_CODE_LINK_CLASS, docCodeHref, DocCodeLink } from "@/components/ui/doc-code-link";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useBranches } from "@/features/settings/settings-queries";
import { api, errorMessage } from "@/lib/api-client";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { useCurrentUser } from "@/lib/use-current-user";
import { cn } from "@/lib/utils";
import { exportReturnLinesCsv } from "./purchase-csv-export";
import { DocStatusBadge } from "./purchase-list-chrome";
import { commonVatRate } from "./purchase-math";
import { useReceipt, useReturn } from "./purchase-queries";
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

const TAB = "border-b-2 pb-2 pt-2.5 text-[13px]";

/**
 * Chi tiết phiếu trả hàng nhập mở dưới dòng (KiotViet #/PurchaseReturns): tab Thông tin / Lịch sử thanh toán,
 * bảng hàng (Giá nhập lấy từ phiếu nhập gốc), khối tổng, chân Hủy · Sao chép · Xuất file | Mở phiếu · In · "…".
 */
export function ReturnDetailPanel({ id, onClose }: { id: string; onClose?: () => void }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { can } = useCurrentUser();
  const { data: r } = useReturn(id);
  const { data: receipt } = useReceipt(r?.receiptId ?? null);
  const { data: branches = [] } = useBranches();
  const [viewReceipt, setViewReceipt] = useState(false);
  const [tab, setTab] = useState<"info" | "payments">("info");
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

  const purchasePrice = (productId: string, lot: string | null) => {
    const src = receipt?.lines.find((x) => x.productId === productId && (x.lotNumber ?? "") === (lot ?? ""));
    return src ? Number(src.unitPrice) - Number(src.discount) : null;
  };
  const qty = r.lines.reduce((s, l) => s + Number(l.quantity), 0);
  const common = commonVatRate(r.vatMode ?? "LINE", r.lines.map((l) => (l.vatRate == null ? null : Number(l.vatRate))));
  const rows: [string, string][] = [
    [t("summary.subtotalQty", { qty: formatNumber(qty) }), formatMoney(r.subtotal)], [t("lines.discount"), formatMoney(r.discount)],
    [common != null ? `${t("kv.vatRefund")} ${formatNumber(common)}%` : t("kv.vatRefund"), formatMoney(r.vatAmount)],
    [t("returns.cols.supplierDue"), formatMoney(r.total)], [t("returns.cols.supplierPaid"), formatMoney(r.refundAmount)],
  ];
  const manage = can("inventory.manage");
  return (
    <div className="border border-primary bg-background text-[13px]">
      <div className="flex gap-6 border-b border-[#e5e7eb] px-4">
        <button type="button" className={cn(TAB, tab === "info" ? "border-primary font-semibold text-primary" : "border-transparent")}
          onClick={() => (tab === "info" ? onClose?.() : setTab("info"))}>{t("kv.tabInfo")}</button>
        <button type="button" className={cn(TAB, tab === "payments" ? "border-primary font-semibold text-primary" : "border-transparent")}
          onClick={() => setTab("payments")}>{t("kv.tabPayments")}</button>
      </div>
      {tab === "payments" ? (
        <div className="p-4">
          <table className="w-full">
            <thead className="bg-[#eff0f3] text-left text-xs font-bold"><tr className="h-[30px]">
              <th className="px-2">{t("kv.voucherCode")}</th><th className="px-2">{t("receipts.cols.time")}</th>
              <th className="px-2">{t("panel.paymentMethod")}</th><th className="px-2">{tc("fields.status")}</th>
              <th className="px-2 text-right">{t("kv.amount")}</th></tr></thead>
            <tbody>
              {Number(r.refundAmount) > 0 && r.status !== "DRAFT" ? (
                <tr className="border-b border-[#e5e7eb]">
                  <td className="px-2 py-2.5"><DocCodeLink code={`PT${r.code}`} className={r.status === "CANCELLED" ? "line-through" : undefined} /></td>
                  <td className="px-2 py-2.5">{formatDateTime(r.returnedAt)}</td>
                  <td className="px-2 py-2.5">{r.paymentMethod === "TRANSFER" ? t("payMethods.transfer") : t("payMethods.cash")}</td>
                  <td className="px-2 py-2.5">{r.status === "CANCELLED" ? t("status.cancelled") : t("kv.paid")}</td>
                  <td className="px-2 py-2.5 text-right">{formatMoney(r.refundAmount)}</td>
                </tr>
              ) : <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">{t("kv.noPayments")}</td></tr>}
            </tbody>
          </table>
        </div>
      ) : (
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
              <th className="px-2">{t("lines.productCode")}</th><th className="px-2">{t("lines.productName")}</th>
              <th className="px-2 text-right">{t("lines.quantity")}</th><th className="px-2 text-right">{t("kv.purchasePrice")}</th>
              <th className="px-2 text-right">{t("lines.returnPrice")}</th><th className="px-2 text-right">{t("kv.returnPriceWithVat")}</th>
              <th className="px-2 text-right">{t("lines.amount")}</th>
            </tr></thead>
            <tbody>
              {r.lines.map((l) => {
                const pp = purchasePrice(l.productId, l.lotNumber);
                return (
                  <tr key={l.id} className="border-b border-[#e5e7eb] align-top hover:bg-[#edeef0]">
                    <td className="px-2 py-2.5"><DocCodeLink code={l.productCode} /></td>
                    <td className="max-w-[260px] px-2 py-2.5">{l.productName} ({l.unitName})
                      {l.lotNumber && <div className="text-xs text-muted-foreground">{t("lines.lotNumber")}: {l.lotNumber}</div>}
                      {l.note && <div className="text-xs text-muted-foreground">{l.note}</div>}</td>
                    <td className="px-2 py-2.5 text-right">{formatNumber(l.quantity)}</td>
                    <td className="px-2 py-2.5 text-right">{pp == null ? "" : formatNumber(pp)}</td>
                    <td className="px-2 py-2.5 text-right">{formatNumber(l.unitPrice)}</td>
                    <td className="px-2 py-2.5 text-right">{formatNumber(l.priceWithVat)}</td>
                    <td className="px-2 py-2.5 text-right font-bold">{formatMoney(l.amount)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="flex items-start gap-6">
            <p className="min-h-[60px] max-w-[720px] flex-1 whitespace-pre-wrap rounded-md border border-[#e5e7eb] p-2 text-muted-foreground">
              {r.note || t("detail.notePlaceholder")}</p>
            <dl className="ml-auto grid w-[300px] shrink-0 grid-cols-[1fr_110px] gap-y-2.5">
              {rows.map(([k, v]) => <div key={k} className="contents"><dt className="text-right">{k}</dt><dd className="text-right">{v}</dd></div>)}
            </dl>
          </div>
        </div>
      )}
      {manage && (
        <div className="flex flex-wrap items-center gap-1 border-t border-[#e5e7eb] px-2 py-2.5">
          {r.status !== "CANCELLED" && (
            <Button variant="ghost" disabled={cancel.isPending}
              onClick={() => confirm(t(r.status === "COMPLETED" ? "detail.confirmCancelReturnCompleted" : "detail.confirmCancelReturn", { code: r.code })) && cancel.mutate()}>
              <Trash2 className="size-4" /> {tc("actions.cancel")}</Button>
          )}
          <Button variant="ghost" onClick={() => router.push(`/purchases/returns/new?copyFrom=${r.id}`)}><Copy className="size-4" /> {tc("actions.copy")}</Button>
          <Button variant="ghost" onClick={() => exportReturnLinesCsv(r, t)}><FileOutput className="size-4" /> {tc("actions.export")}</Button>
          <div className="ml-auto flex gap-2">
            {r.status === "DRAFT" && (
              <Button className="h-[30px] rounded-md px-3" onClick={() => router.push(`/purchases/returns/new?edit=${r.id}`)}>
                <ExternalLink className="size-4" /> {t("detail.openDoc")}</Button>
            )}
            <PrintButton type="PURCHASE_RETURN" data={purchaseReturnData(r)} branchId={r.branchId} />
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex size-[30px] items-center justify-center rounded-md border hover:bg-muted" aria-label={tc("actions.more")}>
                <Ellipsis className="size-4" /></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {r.receiptId && <DropdownMenuItem onClick={() => setViewReceipt(true)}>{t("kv.viewReceipt")}</DropdownMenuItem>}
                <DropdownMenuItem onClick={() => router.push(`/purchases/returns/new?copyFrom=${r.id}`)}><Copy className="size-4" /> {tc("actions.copy")}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )}
      {viewReceipt && r.receiptId && <ReceiptViewDialog id={r.receiptId} onClose={() => setViewReceipt(false)} />}
    </div>
  );
}
