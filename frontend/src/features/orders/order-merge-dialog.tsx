"use client";

import { Fragment, useEffect, useState } from "react";
import { Inbox } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { kvDialog, kvDialogFooter, kvDialogHeader, kvDialogTitle, kvFooterBtn, kvSubHead, kvSubRow } from "@/features/sales/customer-ui-primitives";
import { SALES_KEYS } from "@/features/sales/sales-queries";
import { api, errorMessage } from "@/lib/api-client";
import { formatDateTime, formatMoney } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { commonNs } from "@/messages/common";
import { ordersNs } from "@/messages/orders";
import { ORDER_STATUS_KEY, type Order, type OrderStatus } from "./order-types";

type Candidate = { id: string; code: string; orderedAt: string; status: OrderStatus; total: number; deposit: number };
type Group = { customerId: string; customerCode: string | null; customerName: string; customerPhone: string | null; orders: Candidate[] };

/**
 * "Gộp đơn" đặt hàng: đơn mở (Phiếu tạm / Đã xác nhận, chưa có hóa đơn) cùng khách, tạo trong 7 ngày qua, nhóm theo khách.
 * Mặc định chọn hết; bỏ chọn được. Mỗi nhóm còn ≥ 2 đơn → gộp vào đơn cũ nhất của nhóm (server kiểm tra lại mọi điều kiện).
 */
export function OrderMergeDialog({ branchId, onClose }: { branchId: string; onClose: () => void }) {
  const t = useT(ordersNs);
  const tc = useT(commonNs);
  const qc = useQueryClient();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ["order-merge-candidates", branchId], enabled: !!branchId,
    queryFn: () => api<{ groups: Group[] }>(`/orders/merge-candidates?branchId=${branchId}`) });
  useEffect(() => { if (data) setPicked(new Set(data.groups.flatMap((g) => g.orders.map((o) => o.id)))); }, [data]);
  const groups = data?.groups ?? [];
  const ready = groups.map((g) => g.orders.filter((o) => picked.has(o.id)).map((o) => o.id)).filter((ids) => ids.length >= 2);
  const toggle = (id: string, on: boolean) => setPicked((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n; });

  const submit = async () => {
    setBusy(true);
    const done: string[] = [];
    try {
      for (const orderIds of ready) {
        done.push((await api<Order>("/orders/merge", { method: "POST", body: { branchId, orderIds } })).code);
      }
      toast.success(t("kv.merge.done", { n: done.length, codes: done.join(", ") }));
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      SALES_KEYS.forEach((k) => qc.invalidateQueries({ queryKey: k }));
      qc.invalidateQueries({ queryKey: ["order-merge-candidates"] });
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={cn(kvDialog, "sm:max-w-[730px]")}>
        <DialogHeader className={kvDialogHeader}><DialogTitle className={kvDialogTitle}>{t("kv.merge.title")}</DialogTitle></DialogHeader>
        <div className="px-5 pb-4 text-[13px]">
          <p className="mb-2">{t("kv.merge.intro")}</p>
          <div className="max-h-[50vh] overflow-y-auto">
            {!!groups.length && <table className="w-full">
              <thead className={kvSubHead}><tr><th className="w-8" /><th>{t("cols.code")}</th><th>{t("cols.time")}</th><th>{t("cols.status")}</th>
                <th className="text-right">{t("cols.total")}</th><th className="text-right">{t("cols.paid")}</th></tr></thead>
              <tbody>
                {groups.map((g) => (
                  <Fragment key={g.customerId}>
                    <tr className="bg-[#f7f8fa] font-semibold [&_td]:h-8 [&_td]:px-2"><td colSpan={6}>
                      {[g.customerCode, g.customerName, g.customerPhone].filter(Boolean).join(" - ")}</td></tr>
                    {g.orders.map((o, i) => (
                      <tr key={o.id} className={kvSubRow}>
                        <td><input type="checkbox" className="size-4 rounded accent-primary" aria-label={o.code} checked={picked.has(o.id)}
                          onChange={(e) => toggle(o.id, e.target.checked)} /></td>
                        <td>{o.code}{i === 0 && <span className="ml-1 text-muted-foreground">{t("kv.merge.target")}</span>}</td>
                        <td>{formatDateTime(o.orderedAt)}</td><td>{t(ORDER_STATUS_KEY[o.status])}</td>
                        <td className="text-right">{formatMoney(o.total)}</td><td className="text-right">{formatMoney(o.deposit)}</td>
                      </tr>))}
                  </Fragment>))}
              </tbody>
            </table>}
            {!isLoading && !groups.length && (
              <div className="py-8 text-center">
                <div className="mx-auto mb-4 flex size-[88px] items-center justify-center rounded-full bg-primary-tint-light">
                  <div className="flex size-14 items-center justify-center rounded-full bg-primary-tint-strong"><Inbox className="size-8 text-primary" /></div>
                </div>
                <p className="font-semibold">{t("kv.merge.empty")}</p>
              </div>)}
          </div>
        </div>
        {!!groups.length && (
          <DialogFooter className={kvDialogFooter}>
            <Button variant="outline" className={kvFooterBtn} onClick={onClose}>{tc("actions.skip")}</Button>
            <Button className={kvFooterBtn} disabled={!ready.length || busy} onClick={() => void submit()}>
              {t("kv.merge.submit", { n: ready.length })}</Button>
          </DialogFooter>)}
      </DialogContent>
    </Dialog>
  );
}
