"use client";

import Link from "next/link";
import { useSalesChannels } from "@/features/delivery/delivery-queries";
import { useUserLookup } from "@/features/purchases/purchase-queries";
import { CheckOption, FILTER_FIELD, FilterSection, FilterSidebar, PeriodFilter } from "@/features/sales/invoice-list-kit";
import type { Period } from "@/features/sales/sales-queries";
import { useT } from "@/lib/i18n";
import { ordersNs } from "@/messages/orders";
import { OrderAreaFilter } from "./order-area-filter";
import { OrderStatusChips } from "./order-status-chips";
import type { OrderStatus } from "./order-types";

/**
 * Bộ lọc Đặt hàng (KiotViet): Thời gian, Trạng thái (thẻ, mặc định trừ Đã hủy), Thời gian giao hàng (dự kiến), Phương thức
 * thanh toán (quỹ của phiếu cọc), Khu vực giao hàng (tỉnh / phường-xã lưu trên đơn), Người tạo, Người nhận đặt, Kênh bán
 * (+ Tạo mới ở Thiết lập → Đơn hàng). Đơn đặt hàng chưa có vận đơn nên không có Đối tác giao hàng / trạng thái "Đang giao hàng".
 */
export type OrderFilters = {
  period: Period; statuses: OrderStatus[]; delivery: Period; funds: string[]; createdBy: string; sellerId: string; channel: string;
  areas: string[];
};
export const DEFAULT_ORDER_FILTERS: OrderFilters = { period: { mode: "month", from: "", to: "" }, statuses: ["DRAFT", "CONFIRMED", "COMPLETED"],
  delivery: { mode: "all", from: "", to: "" }, funds: [], createdBy: "", sellerId: "", channel: "", areas: [] };
const FUNDS = ["CASH", "BANK", "EWALLET"] as const;

export function OrderFilterSidebar({ value, onChange }: { value: OrderFilters; onChange: (f: OrderFilters) => void }) {
  const t = useT(ordersNs);
  const { data: users = [] } = useUserLookup();
  const { data: channels = [] } = useSalesChannels();
  const set = (p: Partial<OrderFilters>) => onChange({ ...value, ...p });
  const userSelect = (key: "createdBy" | "sellerId", label: string) => (
    <FilterSection title={label}>
      <select className={FILTER_FIELD} aria-label={label} value={value[key]} onChange={(e) => set({ [key]: e.target.value })}>
        <option value="">{t("kv.pickUser")}</option>{users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}</select>
    </FilterSection>);
  return (
    <FilterSidebar>
      <PeriodFilter value={value.period} onChange={(period) => set({ period })} />
      <FilterSection title={t("kv.status")}><OrderStatusChips value={value.statuses} onChange={(statuses) => set({ statuses })} /></FilterSection>
      <PeriodFilter title={t("kv.deliveryTime")} allowAll value={value.delivery} onChange={(delivery) => set({ delivery })} />
      <FilterSection title={t("kv.payment")}>
        {FUNDS.map((f) => <CheckOption key={f} checked={value.funds.includes(f)}
          onChange={(on) => set({ funds: on ? [...value.funds, f] : value.funds.filter((x) => x !== f) })}>{t(`kv.funds.${f}`)}</CheckOption>)}
      </FilterSection>
      <FilterSection title={t("kv.area")}><OrderAreaFilter value={value.areas} onChange={(areas) => set({ areas })} /></FilterSection>
      {userSelect("createdBy", t("kv.createdBy"))}
      {userSelect("sellerId", t("kv.seller"))}
      <section className="space-y-2">
        <div className="flex items-center justify-between"><span className="text-[13px] font-semibold">{t("kv.channel")}</span>
          <Link href="/settings/orders" className="text-[13px] text-[#2171bc] hover:text-[#1a9dcc]">{t("kv.newChannel")}</Link></div>
        <select className={FILTER_FIELD} aria-label={t("kv.channel")} value={value.channel} onChange={(e) => set({ channel: e.target.value })}>
          <option value="">{t("kv.pickChannel")}</option>{channels.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</select>
      </section>
    </FilterSidebar>
  );
}
