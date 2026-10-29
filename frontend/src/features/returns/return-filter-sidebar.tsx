"use client";

import { usePartnerOptions } from "@/features/delivery/delivery-queries";
import { ShipmentStatusSelect } from "@/features/delivery/shipment-status-select";
import { CheckOption, FILTER_FIELD, FilterSection, FilterSidebar, PeriodFilter } from "@/features/sales/invoice-list-kit";
import type { Period } from "@/features/sales/sales-queries";
import { useT } from "@/lib/i18n";
import { salesNs } from "@/messages/sales";

/**
 * Bộ lọc Trả hàng (KiotViet): Thời gian, Loại trả hàng (Theo hóa đơn / Trả nhanh / Chuyển hoàn — dữ liệu không có loại "Hoàn tiền"),
 * Trạng thái (Đã trả / Đã hủy — phiếu trả không có "Đang xử lý"), Trạng thái giao hàng + Đối tác giao hàng (theo vận đơn bán).
 * Không có Trạng thái HĐĐT (chưa xuất HĐĐT cho phiếu trả) và CSDL về dược.
 */
export type ReturnFilters = { period: Period; types: string[]; statuses: string[]; deliveryStatuses: string[]; partnerId: string };
export const RETURN_TYPES = ["INVOICE", "QUICK", "SHIPMENT"] as const;
export const DEFAULT_RETURN_FILTERS: ReturnFilters = { period: { mode: "month", from: "", to: "" }, types: [...RETURN_TYPES],
  statuses: ["COMPLETED"], deliveryStatuses: [], partnerId: "" };

const toggle = (list: string[], v: string, on: boolean) => (on ? [...list, v] : list.filter((x) => x !== v));

export function ReturnFilterSidebar({ value, onChange }: { value: ReturnFilters; onChange: (f: ReturnFilters) => void }) {
  const t = useT(salesNs);
  const { data: partners = [] } = usePartnerOptions();
  const set = (p: Partial<ReturnFilters>) => onChange({ ...value, ...p });
  return (
    <FilterSidebar>
      <FilterSection title={t("returns.kv.type")}>
        {RETURN_TYPES.map((v) => <CheckOption key={v} checked={value.types.includes(v)} onChange={(on) => set({ types: toggle(value.types, v, on) })}>
          {t(`returns.kv.types.${v}`)}</CheckOption>)}
      </FilterSection>
      <FilterSection title={t("returns.kv.status")}>
        {(["COMPLETED", "CANCELLED"] as const).map((v) => <CheckOption key={v} checked={value.statuses.includes(v)}
          onChange={(on) => set({ statuses: toggle(value.statuses, v, on) })}>{t(`returns.kv.statuses.${v}`)}</CheckOption>)}
      </FilterSection>
      <FilterSection title={t("returns.kv.deliveryStatus")}>
        <ShipmentStatusSelect value={value.deliveryStatuses} onChange={(deliveryStatuses) => set({ deliveryStatuses })} placeholder={t("returns.kv.pickStatus")} />
      </FilterSection>
      <FilterSection title={t("returns.kv.partner")}>
        <select className={FILTER_FIELD} aria-label={t("returns.kv.partner")} value={value.partnerId} onChange={(e) => set({ partnerId: e.target.value })}>
          <option value="">{t("returns.kv.pickPartner")}</option>{partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
      </FilterSection>
      <PeriodFilter allowAll value={value.period} onChange={(period) => set({ period })} />
    </FilterSidebar>
  );
}
