"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api-client";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { saleNs } from "@/messages/sale";

type RecentPrice = { invoiceCode: string; soldAt: string; customerName: string; quantity: number; price: number };

/** "Xem giá bán gần nhất": 10 lần bán gần nhất (ưu tiên đúng khách) → chọn 1 dòng → "Áp dụng giá bán" (hoặc bấm đúp). */
export function RecentPriceDialog({ productId, productName, customerId, onApply, onClose }: {
  productId: string; productName: string; customerId: string | null; onApply: (price: number) => void; onClose: () => void;
}) {
  const t = useT(saleNs);
  const tc = useT(commonNs);
  const [picked, setPicked] = useState<RecentPrice | null>(null);
  const { data = [], isLoading } = useQuery({
    queryKey: ["recent-prices", productId, customerId],
    queryFn: () => api<RecentPrice[]>(`/invoices/recent-prices?productId=${productId}${customerId ? `&customerId=${customerId}` : ""}`),
  });
  const apply = (r: RecentPrice | null) => { if (r) { onApply(Number(r.price)); onClose(); } };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-5 p-6 text-[13px] sm:max-w-[584px]">
        <DialogHeader><DialogTitle className="pr-8 text-[15px] font-bold">{productName}</DialogTitle></DialogHeader>
        <div className="overflow-hidden rounded-sm border border-[#e5e7eb]">
          <table className="w-full">
            <thead className="bg-primary-soft text-white">
              <tr className="h-[33px] font-bold">
                <th className="px-3 text-left">{t("sync.code")}</th><th className="px-3 text-right">{t("line.qty")}</th>
                <th className="px-3 text-right">{t("settings.price.price")}</th><th className="px-3 text-right">{t("line.amount")}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.invoiceCode} aria-selected={picked === r} onClick={() => setPicked(r)} onDoubleClick={() => apply(r)}
                  className={`cursor-pointer border-b border-[#f0f1f3] ${picked === r ? "bg-primary/10" : "hover:bg-primary/5"}`}>
                  <td className="px-3 py-2"><span className="font-medium text-primary">{r.invoiceCode}</span>
                    <span className="block text-xs text-muted-foreground">{formatDateTime(r.soldAt)} · {r.customerName}</span></td>
                  <td className="px-3 text-right">{formatNumber(r.quantity)}</td>
                  <td className="px-3 text-right">{formatMoney(r.price)}</td>
                  <td className="px-3 text-right font-semibold">{formatMoney(Math.round(Number(r.quantity) * Number(r.price)))}</td>
                </tr>))}
            </tbody>
          </table>
          {!isLoading && !data.length && (
            <div className="flex h-[204px] flex-col items-center justify-center gap-3 text-muted-foreground">
              <Inbox className="size-11 stroke-[1.25] text-[#c4c8ce]" />{t("dialogs.noData")}
            </div>)}
          {isLoading && <div className="flex h-[204px] items-center justify-center text-muted-foreground">{tc("status.loading")}</div>}
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="outline" className="h-9 min-w-[92px] border-primary text-[13px] font-semibold text-primary" onClick={onClose}>{tc("actions.skip")}</Button>
          <Button className="h-9 min-w-[136px] text-[13px] font-semibold" disabled={!picked} onClick={() => apply(picked)}>{t("recentPrice.apply")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
