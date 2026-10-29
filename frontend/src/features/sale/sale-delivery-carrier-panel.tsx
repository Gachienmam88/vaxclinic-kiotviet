"use client";

import { Lightbulb, PersonStanding, Settings, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { saleNs } from "@/messages/sale";
import { SaleDeliverySelfTab } from "./sale-delivery-self-tab";
import type { DraftInvoice } from "./sale-types";
import type { SaleLookups } from "./use-sale-lookups";

export type DeliveryTab = "PORTAL" | "SELF";

/**
 * Cột phải của Bán giao hàng: tab "Cổng KiotViet" / "Tự giao hàng" (tab đang mở nền trắng chữ màu chủ đạo, tab kia xám)
 * + nút THANH TOÁN (F9). Dự án chưa kết nối cổng / hãng vận chuyển nào → tab cổng chỉ có hướng dẫn và thông báo chưa kết nối
 * (không có hãng, giá cước giả); vận đơn tạo qua Tự giao hàng.
 */
export function SaleDeliveryCarrierPanel({ draft, update, lookups, tab, onTab, onPay, paying }: {
  draft: DraftInvoice; update: (p: Partial<DraftInvoice>) => void; lookups: SaleLookups; tab: DeliveryTab; onTab: (t: DeliveryTab) => void;
  onPay: () => void; paying: boolean;
}) {
  const t = useT(saleNs);
  const tc = useT(commonNs);
  const tabs = [["PORTAL", t("delivery.tabs.portal"), Truck], ["SELF", t("delivery.tabs.self"), PersonStanding]] as const;
  return (
    <div className="flex h-full flex-col text-[13px]">
      <div role="tablist" className="flex h-10 shrink-0 overflow-hidden rounded-t-lg">
        {tabs.map(([key, label, Icon]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => onTab(key)}
            className={`flex flex-1 items-center justify-center gap-1.5 font-medium ${tab === key ? "bg-background text-primary" : "bg-[#eef0f3] text-[#4b5563]"}`}>
            <Icon className="size-4" />{label}
          </button>))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto bg-background px-3 pt-4">
        {tab === "SELF" ? <SaleDeliverySelfTab draft={draft} update={update} lookups={lookups} /> : (
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <p className="flex flex-1 gap-2 rounded-md border border-[#bfdbfe] bg-[#eff6ff] px-3 py-2 text-[#1f2329]">
                <Lightbulb className="mt-0.5 size-4 shrink-0 text-[#2171bc]" />{t("delivery.portalHint")}</p>
              <button type="button" disabled className="mt-1 text-[#4b5563] disabled:opacity-60" aria-label={t("delivery.portalSettings")}
                title={t("delivery.portalSettings")}><Settings className="size-[18px]" /></button>
            </div>
            <p className="rounded-md bg-[#eef0f3] px-3 py-2.5 text-[#4b5563]">{t("delivery.portalNotConnected")}</p>
            <Button variant="outline" className="h-8 w-full" onClick={() => onTab("SELF")}>{t("delivery.useSelf")}</Button>
          </div>)}
      </div>
      <div className="shrink-0 bg-background px-2 pt-2 pb-2">
        <Button title="F9" className="h-12 w-full rounded-md bg-chrome text-[15px] font-bold uppercase hover:bg-chrome-hover"
          disabled={paying || !draft.lines.length} onClick={onPay}>{paying ? tc("status.saving") : t("checkout.pay")}</Button>
      </div>
    </div>
  );
}
