"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { NumberInput } from "@/components/number-input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { ProductDetail } from "@/features/products/product-types";
import { api } from "@/lib/api-client";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { saleNs } from "@/messages/sale";
import { underlineInput } from "./sale-ui-parts";

type Lot = { id: string; lotNumber: string; expiryDate: string; quantity: number };
type Tab = "info" | "desc";

/**
 * "Xem chi tiết": drawer bên phải — tab Thông tin chung (giá bán, số lượng trên dòng, tồn, nhóm, vị trí, thuế, lô)
 * và Mô tả chi tiết. "Xong" áp dụng số lượng đã sửa, "Bỏ qua" đóng không đổi.
 */
export function SaleProductDetailDrawer({ productId, productName, quantity, onApply, onClose }: {
  productId: string; productName: string; quantity: number; onApply: (quantity: number) => void; onClose: () => void;
}) {
  const t = useT(saleNs);
  const tc = useT(commonNs);
  const [tab, setTab] = useState<Tab>("info");
  const [qty, setQty] = useState(quantity);
  const { data: p } = useQuery({ queryKey: ["product", productId], queryFn: () => api<ProductDetail>(`/products/${productId}`) });
  const { data: lots = [] } = useQuery({
    queryKey: ["product-lots", productId], enabled: !!p?.lotManaged,
    queryFn: () => api<Lot[]>(`/products/${productId}/lots`),
  });
  const stock = p?.stocks.reduce((s, b) => s + Number(b.quantity), 0) ?? 0;
  const row = "flex min-h-[52px] items-center gap-4 border-b border-dashed border-[#d6d9de] py-2";
  const tabCls = (x: Tab) =>
    `h-full border-b-2 text-[13px] font-semibold ${tab === x ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="top-0 right-0 left-auto flex h-full max-h-none w-[765px] max-w-[calc(100%-3rem)] translate-x-0 translate-y-0 flex-col gap-0 rounded-none rounded-l-xl p-0 text-[13px] sm:max-w-[calc(100%-3rem)] data-open:zoom-in-100 data-closed:zoom-out-100">
        <DialogTitle className="px-7 pt-7 pr-14 pb-4 text-[15px] font-bold">{productName}</DialogTitle>
        <div role="tablist" className="flex h-9 gap-10 border-b px-7">
          <button type="button" role="tab" aria-selected={tab === "info"} className={tabCls("info")} onClick={() => setTab("info")}>{t("detail.tabs.info")}</button>
          <button type="button" role="tab" aria-selected={tab === "desc"} className={tabCls("desc")} onClick={() => setTab("desc")}>{t("detail.tabs.desc")}</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-[60px] py-5">
          {!p && <p className="text-muted-foreground">{tc("status.loading")}</p>}
          {p && tab === "info" && (
            <>
              <div className="flex min-h-9 items-center gap-4"><span className="w-28 font-medium">{t("detail.price")}</span>
                <span className="text-[15px] font-bold text-primary">{p.units.map((u) => `${formatMoney(u.price)} / ${u.unitName}`).join(" · ")}</span></div>
              <div className={row}><span className="w-28 font-medium">{t("detail.qty")}</span>
                <NumberInput aria-label={t("detail.qtyAria")} className={`${underlineInput} w-12 text-center`} value={qty}
                  onValueChange={(v) => setQty(Math.max(v, 0))} />
                <span className="ml-auto text-muted-foreground">{t("detail.stock", { qty: formatNumber(stock) })}</span></div>
              {([["detail.category", p.categoryName], ["detail.position", p.positionName], ["detail.taxRate", p.taxRateName]] as const).map(([k, v]) => (
                <div key={k} className={row}><span className="w-28 font-medium">{t(k)}:</span><span>{v || ""}</span></div>))}
              {p.lotManaged && (
                <div className="py-3"><span className="font-medium">{t("detail.lots")}</span>
                  {lots.map((l) => <div key={l.id} className="mt-1 ml-2">• {t("detail.lotLine", { lot: l.lotNumber, expiry: formatDate(l.expiryDate), qty: formatNumber(l.quantity) })}</div>)}
                </div>)}
            </>
          )}
          {p && tab === "desc" && (
            <p className="whitespace-pre-wrap">{p.description || p.note || <span className="text-muted-foreground">{t("detail.noDesc")}</span>}</p>
          )}
        </div>
        <div className="flex justify-end gap-3 px-7 py-6">
          <Button variant="outline" className="h-9 min-w-[92px] border-primary text-[13px] font-semibold text-primary" onClick={onClose}>{tc("actions.skip")}</Button>
          <Button className="h-9 min-w-[92px] text-[13px] font-semibold"
            onClick={() => { if (qty > 0 && qty !== quantity) onApply(qty); onClose(); }}>{tc("actions.done")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
