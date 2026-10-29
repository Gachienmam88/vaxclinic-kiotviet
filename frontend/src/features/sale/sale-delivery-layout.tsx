"use client";

import { useState } from "react";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { useT } from "@/lib/i18n";
import { saleNs } from "@/messages/sale";
import { SaleDeliveryCarrierPanel, type DeliveryTab } from "./sale-delivery-carrier-panel";
import { SaleDeliveryInfoPanel } from "./sale-delivery-info-panel";
import { SaleDeliveryTotalsCard } from "./sale-delivery-totals-card";
import type { DraftInvoice } from "./sale-types";
import type { SaleLookups } from "./use-sale-lookups";
import type { SaleBranch } from "./use-sale-branch";

/**
 * Bố cục 3 cột của "Bán giao hàng" (KiotViet): trái = giỏ hàng + thẻ tổng tiền; giữa = khách, người nhận, kiện hàng, COD
 * (nút » thu gọn / mở lại); phải = tab Cổng giao hàng / Tự giao hàng + THANH TOÁN. Chưa kết nối cổng nào → mặc định Tự giao hàng.
 */
export function SaleDeliveryLayout({ draft, update, lookups, branch, cart, onPay, paying }: {
  draft: DraftInvoice; update: (p: Partial<DraftInvoice>) => void; lookups: SaleLookups; branch: SaleBranch; cart: React.ReactNode;
  onPay: () => void; paying: boolean;
}) {
  const t = useT(saleNs);
  const [tab, setTab] = useState<DeliveryTab>("SELF");
  const [collapsed, setCollapsed] = useState(false);
  return (
    <>
      <section className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="min-h-0 flex-1 overflow-y-auto">{cart}</div>
        <SaleDeliveryTotalsCard draft={draft} update={update} />
      </section>
      <button type="button" onClick={() => setCollapsed(!collapsed)} className="-mx-1.5 self-center text-[#1f2329] hover:text-primary"
        aria-label={t(collapsed ? "delivery.expand" : "delivery.collapse")} title={t(collapsed ? "delivery.expand" : "delivery.collapse")}>
        {collapsed ? <ChevronsLeft className="size-4" /> : <ChevronsRight className="size-4" />}
      </button>
      {!collapsed && <SaleDeliveryInfoPanel draft={draft} update={update} lookups={lookups} branch={branch} portal={tab === "PORTAL"} />}
      <aside className="w-[362px] shrink-0 overflow-hidden rounded-lg">
        <SaleDeliveryCarrierPanel draft={draft} update={update} lookups={lookups} tab={tab} onTab={setTab} onPay={onPay} paying={paying} />
      </aside>
    </>
  );
}
