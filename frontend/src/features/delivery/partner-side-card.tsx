"use client";

import { Bell, Bike, Mail, MapPin, Package, Phone } from "lucide-react";
import { FilterSection, RadioOption } from "@/features/sales/invoice-list-kit";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { commonNs } from "@/messages/common";
import { deliveryNs } from "@/messages/delivery";

export type PartnerSideTab = "integrated" | "other";
const HELP = "https://www.kiotviet.vn/huong-dan-su-dung-kiotviet/retail-giao-van/quan-ly-doi-tac-giao-hang/";

/** Minh họa tự vẽ bằng icon (không dùng ảnh / logo của bên khác): xe giao hàng giữa các điểm liên lạc. */
function Illustration() {
  const dot = "absolute grid place-items-center rounded-full text-white shadow";
  return (
    <div className="relative mx-auto h-[150px] w-full overflow-hidden rounded-md bg-gradient-to-b from-[#eef7f0] to-white">
      <div className="absolute inset-x-6 top-6 h-[110px] rounded-t-full border-2 border-dashed border-[#c9d6cf]" />
      <span className={cn(dot, "top-2 left-1/2 size-10 -translate-x-1/2 bg-[#f4a261]")}><Mail className="size-5" /></span>
      <span className={cn(dot, "top-12 left-6 size-8 bg-[#3b82f6]")}><Bell className="size-4" /></span>
      <span className={cn(dot, "top-12 right-6 size-8 bg-[#22a06b]")}><Phone className="size-4" /></span>
      <MapPin className="absolute bottom-4 left-4 size-8 fill-[#1d6fb8] text-white" />
      <MapPin className="absolute right-4 bottom-4 size-8 fill-[#3b9fe0] text-white" />
      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-end gap-0.5">
        <Package className="mb-3 size-5 text-[#f4a261]" /><Bike className="size-12 text-[#16a34a]" />
      </div>
      <div className="absolute inset-x-0 bottom-2 h-px bg-[#9ca3af]" />
    </div>
  );
}

/**
 * Thẻ trái trang Đối tác giao hàng: tab "Tích hợp" (chưa kết nối hãng vận chuyển nào → chỉ minh họa + link hướng dẫn, bảng trống)
 * / "Khác" (đối tác cửa hàng tự quản lý + lọc trạng thái, công nợ).
 */
export function PartnerSideCard({ tab, onTab, active, onActive, debt, onDebt }: {
  tab: PartnerSideTab; onTab: (t: PartnerSideTab) => void; active: string; onActive: (v: string) => void; debt: string; onDebt: (v: string) => void;
}) {
  const t = useT(deliveryNs);
  const tc = useT(commonNs);
  const ACTIVE = [["", tc("status.all")], ["true", tc("status.active")], ["false", tc("status.inactive")]] as const;
  const DEBT = [["", tc("status.all")], ["OWING", t("partners.debtOwing")], ["PAYABLE", t("partners.debtPayable")]] as const;
  return (
    <div className="w-[190px] shrink-0 rounded-lg bg-background">
      <div className="flex gap-5 border-b px-3" role="tablist">
        {(["integrated", "other"] as const).map((k) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => onTab(k)}
            className={cn("relative h-10 text-[13px]", tab === k ? "text-primary" : "text-foreground")}>
            {t(k === "integrated" ? "kv.partners.tabIntegrated" : "kv.partners.tabOther")}
            {tab === k && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" />}</button>))}
      </div>
      {tab === "integrated" ? (
        <div className="space-y-2 p-3 text-center">
          <Illustration />
          <p className="font-bold text-[#1d6fb8]">{t("kv.partners.promoTitle")}</p>
          <p className="text-xs">{t("kv.partners.promoSub")}</p>
          <a href={HELP} target="_blank" rel="noopener noreferrer" className="block pt-3 text-[13px] text-[#2171bc] hover:text-[#1a9dcc]">
            {t("kv.partners.promoLink")}</a>
        </div>
      ) : (
        <div className="p-1">
          <FilterSection title={tc("fields.status")}>{ACTIVE.map(([v, l]) => <RadioOption key={v} checked={active === v} onSelect={() => onActive(v)}>{l}</RadioOption>)}</FilterSection>
          <FilterSection title={t("partners.debt")}>{DEBT.map(([v, l]) => <RadioOption key={v} checked={debt === v} onSelect={() => onDebt(v)}>{l}</RadioOption>)}</FilterSection>
        </div>)}
    </div>
  );
}
