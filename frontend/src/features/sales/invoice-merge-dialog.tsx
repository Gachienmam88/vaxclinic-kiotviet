"use client";

import { Fragment, useState } from "react";
import { Inbox } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, errorMessage } from "@/lib/api-client";
import { formatDateTime, formatMoney } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { renderRichText } from "@/lib/i18n/render-rich-text";
import { cn } from "@/lib/utils";
import { commonNs } from "@/messages/common";
import { salesNs } from "@/messages/sales";
import { kvDialog, kvDialogFooter, kvDialogHeader, kvDialogTitle, kvFooterBtn, kvSubHead, kvSubRow } from "./customer-ui-primitives";
import { SALES_KEYS } from "./sales-queries";
import type { Invoice } from "./sales-types";

type Candidate = { id: string; code: string; soldAt: string; total: number; paid: number; customerCode: string | null; customerName: string };
type Group = { key: string; customerCode: string | null; customerName: string; invoices: Candidate[] };
type Candidates = { groups: Group[]; reason: "ORDER_NOT_COMPLETED" | "NO_CANDIDATES" | null };

/**
 * "Gộp hóa đơn" (KiotViet, menu "…"): hóa đơn cùng khách trong 7 ngày qua, nhóm theo khách — chọn ≥ 2 hóa đơn của 1 nhóm
 * → 1 hóa đơn mới (giữ dòng hàng + lô, cộng thanh toán), hóa đơn gốc chuyển Đã hủy. Backend kiểm tra lại mọi điều kiện.
 */
export function InvoiceMergeDialog({ branchId, onClose, onMerged }: { branchId: string; onClose: () => void; onMerged: (inv: Invoice) => void }) {
  const t = useT(salesNs);
  const tc = useT(commonNs);
  const qc = useQueryClient();
  const [group, setGroup] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [mergeId] = useState(() => crypto.randomUUID()); // gửi lại (mạng chập chờn) không gộp 2 lần
  const { data, isLoading } = useQuery({ queryKey: ["invoice-merge-candidates", branchId], enabled: !!branchId,
    queryFn: () => api<Candidates>(`/invoices/merge-candidates?branchId=${branchId}`) });
  const merge = useMutation({
    mutationFn: () => api<Invoice>("/invoices/merge", { method: "POST", body: { id: mergeId, branchId, invoiceIds: picked } }),
    onSuccess: (inv) => {
      SALES_KEYS.forEach((k) => qc.invalidateQueries({ queryKey: k }));
      qc.invalidateQueries({ queryKey: ["invoice-merge-candidates"] });
      toast.success(t("invoices.merge.done", { code: inv.code }));
      onMerged(inv);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const toggle = (g: string, id: string, on: boolean) => {
    const base = group === g ? picked : [];
    setGroup(g);
    setPicked(on ? [...base, id] : base.filter((x) => x !== id));
  };
  const cols = 7;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={cn(kvDialog, "sm:max-w-[730px]")}>
        <DialogHeader className={kvDialogHeader}><DialogTitle className={kvDialogTitle}>{t("invoices.merge.title")}</DialogTitle></DialogHeader>
        <div className="px-5 pb-4 text-[13px]">
          <p className="mb-2">{renderRichText(t("invoices.merge.intro"), { days: <b className="text-primary">{t("invoices.merge.days")}</b> })}</p>
          <div className="max-h-[50vh] overflow-y-auto">
            <table className="w-full">
              <thead className={kvSubHead}><tr><th className="w-8" /><th>{t("invoices.columns.code")}</th><th>{t("invoices.columns.soldAt")}</th>
                <th className="text-right">{t("invoices.columns.total")}</th><th className="text-right">{t("invoices.columns.paid")}</th>
                <th>{t("invoices.merge.customerCode")}</th><th>{t("invoices.merge.customerName")}</th></tr></thead>
              <tbody>
                {data?.groups.map((g) => (
                  <Fragment key={g.key}>
                    <tr className="bg-[#f7f8fa] font-semibold [&_td]:h-8 [&_td]:px-2"><td colSpan={cols}>{[g.customerCode, g.customerName].filter(Boolean).join(" - ")}</td></tr>
                    {g.invoices.map((i) => (
                      <tr key={i.id} className={kvSubRow}>
                        <td><input type="checkbox" className="size-4 rounded accent-primary" aria-label={i.code}
                          checked={group === g.key && picked.includes(i.id)} onChange={(e) => toggle(g.key, i.id, e.target.checked)} /></td>
                        <td>{i.code}</td><td>{formatDateTime(i.soldAt)}</td><td className="text-right">{formatMoney(i.total)}</td>
                        <td className="text-right">{formatMoney(i.paid)}</td><td>{i.customerCode}</td><td>{i.customerName}</td>
                      </tr>))}
                  </Fragment>))}
              </tbody>
            </table>
            {!isLoading && !data?.groups.length && (
              <div className="py-8 text-center">
                <div className="mx-auto mb-4 flex size-[88px] items-center justify-center rounded-full bg-primary-tint-light">
                  <div className="flex size-14 items-center justify-center rounded-full bg-primary-tint-strong"><Inbox className="size-8 text-primary" /></div>
                </div>
                <p className="font-semibold">{t(data?.reason === "ORDER_NOT_COMPLETED" ? "invoices.merge.emptyOrder" : "invoices.merge.empty")}</p>
              </div>)}
          </div>
        </div>
        {!!data?.groups.length && (
          <DialogFooter className={kvDialogFooter}>
            <Button variant="outline" className={kvFooterBtn} onClick={onClose}>{tc("actions.skip")}</Button>
            <Button className={kvFooterBtn} disabled={picked.length < 2 || merge.isPending} onClick={() => merge.mutate()}>
              {t("invoices.merge.submit", { count: picked.length })}</Button>
          </DialogFooter>)}
      </DialogContent>
    </Dialog>
  );
}
