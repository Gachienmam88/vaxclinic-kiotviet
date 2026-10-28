"use client";

import { useState } from "react";
import { CircleDollarSign, Package, Tag } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useT } from "@/lib/i18n";
import { saleNs } from "@/messages/sale";
import { GoodsTab, PaymentTab, PriceTab } from "./sale-settings-tabs";
import { useSaleSettings } from "./use-sale-settings";

const TABS = [["GOODS", "settings.tabs.goods", Package], ["PRICE", "settings.tabs.price", Tag], ["PAYMENT", "settings.tabs.payment", CircleDollarSign]] as const;

/** "Thiết lập & Hiển thị" (lưu theo máy, áp dụng ngay): tab trái Hàng hóa / Giá tiền / Thanh toán. */
export function SaleSettingsDialog({ onClose }: { onClose: () => void }) {
  const { settings: s, set } = useSaleSettings();
  const t = useT(saleNs);
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("GOODS");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="h-[598px] max-h-[90vh] gap-4 p-6 text-[13px] sm:max-w-[566px]">
        <DialogHeader><DialogTitle className="text-[15px] font-bold">{t("menu.settings")}</DialogTitle></DialogHeader>
        <div className="grid min-h-0 grid-cols-[166px_1fr] items-start gap-4">
          <nav className="space-y-1" aria-label={t("settings.groups")}>
            {TABS.map(([k, label, Icon]) => (
              <button key={k} type="button" aria-current={tab === k} onClick={() => setTab(k)}
                className={`flex h-[33px] w-full items-center gap-3 rounded-md px-2.5 text-left ${tab === k ? "bg-primary-tint font-bold" : "hover:bg-muted"}`}>
                <Icon className="size-[18px] text-[#4b5563]" />{t(label)}</button>
            ))}
          </nav>
          <div className="max-h-[500px] overflow-y-auto rounded-md border border-[#e5e7eb] px-3.5 py-3">
            {tab === "GOODS" && <GoodsTab s={s} set={set} />}
            {tab === "PRICE" && <PriceTab s={s} set={set} />}
            {tab === "PAYMENT" && <PaymentTab s={s} set={set} />}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
