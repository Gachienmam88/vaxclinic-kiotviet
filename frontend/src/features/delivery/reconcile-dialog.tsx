"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DocCodeLink } from "@/components/ui/doc-code-link";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { kvDialog, kvDialogBody, kvDialogFooter, kvDialogHeader, kvDialogTitle, kvFooterBtn, kvInput, kvLabel } from "@/features/sales/customer-ui-primitives";
import { SUB_HEAD } from "@/features/sales/invoice-list-kit";
import { api, errorMessage } from "@/lib/api-client";
import { enumLabel } from "@/features/sales/i18n-enum-label";
import { formatDateTime, formatMoney } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { renderRichText } from "@/lib/i18n/render-rich-text";
import { useCurrentUser } from "@/lib/use-current-user";
import { commonNs } from "@/messages/common";
import { deliveryNs } from "@/messages/delivery";
import { salesNs } from "@/messages/sales";
import { refreshDelivery, usePartnerOptions, useReconcilable } from "./delivery-queries";
import type { SettlementResult } from "./delivery-types";

/** Quỹ thu / chi khi thanh toán với đối tác — nhãn: salesNs "enums.fund.<giá trị>". */
export const FUND_OPTIONS = ["CASH", "BANK", "EWALLET"] as const;
const SELECT = `${kvInput} w-full border bg-background px-2`;

/**
 * Đối soát với đối tác giao hàng: chọn vận đơn đã kết thúc (Giao thành công / Đã chuyển hoàn) chưa đối soát →
 * chênh lệch = Σ thu hộ − Σ phí cửa hàng chịu → 1 phiếu thu (đối tác trả) hoặc phiếu chi (cửa hàng trả) ở Sổ quỹ.
 */
export function ReconcileDialog({ partnerId: initial, onClose }: { partnerId?: string; onClose: () => void }) {
  const t = useT(deliveryNs);
  const tc = useT(commonNs);
  const ts = useT(salesNs);
  const qc = useQueryClient();
  const { data: me } = useCurrentUser();
  const branches = me?.user.branches ?? [];
  const { data: partners = [] } = usePartnerOptions();
  const [partnerId, setPartnerId] = useState(initial ?? "");
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [fund, setFund] = useState("CASH");
  const [note, setNote] = useState("");
  const { data } = useReconcilable(partnerId, branchId || branches[0]?.id || "");
  const rows = data ?? [];
  // Mặc định chọn hết vận đơn chờ đối soát: chỉ lưu các vận đơn bị bỏ chọn
  const [excluded, setExcluded] = useState<string[]>([]);
  const chosen = rows.filter((r) => !excluded.includes(r.id));
  const picked = chosen.map((r) => r.id);
  const setPicked = (ids: string[]) => setExcluded(rows.map((r) => r.id).filter((id) => !ids.includes(id)));
  const sum = (f: (r: (typeof rows)[number]) => number) => chosen.reduce((s, r) => s + Number(f(r)), 0);
  const net = sum((r) => r.net);
  const save = useMutation({
    mutationFn: () => api<SettlementResult>(`/delivery-partners/${partnerId}/reconcile`, { method: "POST",
      body: { branchId: branchId || branches[0]?.id, shipmentIds: picked, fund, note: note || null } }),
    onSuccess: (r) => {
      toast.success(r.voucherCode
        ? t("reconcile.doneVoucher", { n: picked.length, code: r.code, voucher: r.voucherCode, amount: formatMoney(Math.abs(r.amount)) })
        : t("reconcile.done", { n: picked.length, code: r.code }));
      refreshDelivery(qc);
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={`${kvDialog} sm:max-w-[820px]`}>
        <DialogHeader className={kvDialogHeader}><DialogTitle className={kvDialogTitle}>{t("reconcile.title")}</DialogTitle></DialogHeader>
        <div className={kvDialogBody}>
          <div className="grid grid-cols-3 gap-3">
            <label className="space-y-1"><span className={kvLabel}>{t("fields.partner")}</span>
              <select className={SELECT} value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
                <option value="">{t("reconcile.pickPartner")}</option>{partners.map((p) => <option key={p.id} value={p.id}>{p.code} - {p.name}</option>)}</select></label>
            <label className="space-y-1"><span className={kvLabel}>{tc("fields.branch")}</span>
              <select className={SELECT} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
            <label className="space-y-1"><span className={kvLabel}>{t("reconcile.fund")}</span>
              <select className={SELECT} value={fund} onChange={(e) => setFund(e.target.value)}>
                {FUND_OPTIONS.map((v) => <option key={v} value={v}>{ts(`enums.fund.${v}`)}</option>)}</select></label>
          </div>
          <div className="max-h-[320px] overflow-y-auto rounded-md border">
            <table className="w-full text-[13px]">
              <thead className={SUB_HEAD}><tr>
                <th><input type="checkbox" aria-label={t("table.selectAll")} className="accent-primary" checked={!!rows.length && picked.length === rows.length}
                  onChange={(e) => setPicked(e.target.checked ? rows.map((r) => r.id) : [])} /></th>
                <th>{t("fields.shipmentCode")}</th><th>{t("fields.invoice")}</th><th>{t("fields.receiver")}</th><th>{t("fields.status")}</th>
                <th>{t("fields.completed")}</th><th className="text-right">{t("fields.codShort")}</th>
                <th className="text-right">{t("reconcile.shopFee")}</th><th className="text-right">{t("reconcile.net")}</th></tr></thead>
              <tbody>
                {!rows.length && <tr><td colSpan={9} className="py-6 text-center text-muted-foreground">{t(partnerId ? "reconcile.noRows" : "reconcile.pickFirst")}</td></tr>}
                {rows.map((r) => (
                  <tr key={r.id} className="border-b [&_td]:h-[30px] [&_td]:px-2">
                    <td><input type="checkbox" aria-label={t("table.selectRow", { code: r.code })} className="accent-primary" checked={picked.includes(r.id)}
                      onChange={(e) => setPicked(e.target.checked ? [...picked, r.id] : picked.filter((x) => x !== r.id))} /></td>
                    <td><DocCodeLink code={r.code} kind="/delivery/shipments" newTab /></td><td><DocCodeLink code={r.invoiceCode} kind="/invoices" newTab /></td><td>{r.receiverName}</td><td>{enumLabel(t, deliveryNs, "status", r.status)}</td>
                    <td>{r.deliveredAt ? formatDateTime(r.deliveredAt) : ""}</td><td className="text-right">{formatMoney(r.cod)}</td>
                    <td className="text-right">{formatMoney(r.fee)}</td><td className="text-right">{formatMoney(r.net)}</td>
                  </tr>))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-6 text-[13px]">
            <span>{renderRichText(t("reconcile.totalCod"), { amount: <b>{formatMoney(sum((r) => r.cod))}</b> })}</span>
            <span>{renderRichText(t("reconcile.totalFee"), { amount: <b>{formatMoney(sum((r) => r.fee))}</b> })}</span>
            <span className="text-[15px]">{renderRichText(t(net >= 0 ? "reconcile.partnerPays" : "reconcile.shopPays"),
              { amount: <b className="text-primary">{formatMoney(Math.abs(net))}</b> })}</span>
          </div>
          <input className={`${kvInput} w-full border px-2`} placeholder={tc("fields.note")} aria-label={tc("fields.note")} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <DialogFooter className={kvDialogFooter}>
          <Button variant="outline" className={kvFooterBtn} onClick={onClose}>{tc("actions.skip")}</Button>
          <Button className={kvFooterBtn} disabled={save.isPending || !partnerId || !picked.length} onClick={() => save.mutate()}>{t("reconcile.submit")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
