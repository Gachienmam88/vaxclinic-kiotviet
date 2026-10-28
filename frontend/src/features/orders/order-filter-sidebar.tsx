"use client";

import { useUserLookup } from "@/features/purchases/purchase-queries";
import { CheckOption, FILTER_FIELD, FilterSection, FilterSidebar, PeriodFilter } from "@/features/sales/invoice-list-kit";
import type { Period } from "@/features/sales/sales-queries";
import { ORDER_STATUS_OPTIONS } from "./order-types";

export type OrderFilters = { period: Period; statuses: string[]; createdBy: string };

const toggle = (list: string[], v: string, on: boolean) => (on ? [...list, v] : list.filter((x) => x !== v));

/** Sidebar lọc trang Đặt hàng: Trạng thái, Thời gian, Người tạo (theo KiotViet). */
export function OrderFilterSidebar({ value, onChange }: { value: OrderFilters; onChange: (f: OrderFilters) => void }) {
  const { data: users = [] } = useUserLookup();
  const set = (p: Partial<OrderFilters>) => onChange({ ...value, ...p });
  return (
    <FilterSidebar>
      <FilterSection title="Trạng thái">
        {ORDER_STATUS_OPTIONS.map(([v, l]) => (
          <CheckOption key={v} checked={value.statuses.includes(v)} onChange={(on) => set({ statuses: toggle(value.statuses, v, on) })}>{l}</CheckOption>))}
      </FilterSection>
      <PeriodFilter value={value.period} onChange={(period) => set({ period })} allowAll />
      <FilterSection title="Người tạo">
        <select className={FILTER_FIELD} aria-label="Người tạo" value={value.createdBy} onChange={(e) => set({ createdBy: e.target.value })}>
          <option value="">Chọn người tạo</option>{users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}</select>
      </FilterSection>
    </FilterSidebar>
  );
}
