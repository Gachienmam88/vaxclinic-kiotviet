"use client";

import { useState } from "react";
import { CircleDollarSign, Package, Tag } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GoodsTab, PaymentTab, PriceTab } from "./sale-settings-tabs";
import { useSaleSettings } from "./use-sale-settings";

const TABS = [["GOODS", "Hàng hóa", Package], ["PRICE", "Giá tiền", Tag], ["PAYMENT", "Thanh toán", CircleDollarSign]] as const;

/** "Thiết lập & Hiển thị" (lưu theo máy, áp dụng ngay): tab trái Hàng hóa / Giá tiền / Thanh toán. */
export function SaleSettingsDialog({ onClose }: { onClose: () => void }) {
  const { settings: s, set } = useSaleSettings();
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("GOODS");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="h-[598px] max-h-[90vh] gap-4 p-6 text-[13px] sm:max-w-[566px]">
        <DialogHeader><DialogTitle className="text-[15px] font-bold">Thiết lập &amp; Hiển thị</DialogTitle></DialogHeader>
        <div className="grid min-h-0 grid-cols-[166px_1fr] items-start gap-4">
          <nav className="space-y-1" aria-label="Nhóm thiết lập">
            {TABS.map(([k, label, Icon]) => (
              <button key={k} type="button" aria-current={tab === k} onClick={() => setTab(k)}
                className={`flex h-[33px] w-full items-center gap-3 rounded-md px-2.5 text-left ${tab === k ? "bg-primary-tint font-bold" : "hover:bg-muted"}`}>
                <Icon className="size-[18px] text-[#4b5563]" />{label}</button>
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
