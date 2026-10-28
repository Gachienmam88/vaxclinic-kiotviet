"use client";

import { useUserLookup } from "@/features/purchases/purchase-queries";
import { CheckOption, FILTER_FIELD, FilterSection, FilterSidebar, PeriodFilter } from "./invoice-list-kit";
import type { Period } from "./sales-queries";
import { PAYMENT_METHODS } from "./sales-types";

export type InvoiceFilters = {
  period: Period; statuses: string[]; methods: string[]; createdBy: string; sellerId: string;
};

export const INVOICE_STATUS_OPTIONS = [["COMPLETED", "Hoàn thành"], ["CANCELLED", "Đã hủy"]] as const;

const toggle = (list: string[], v: string, on: boolean) => (on ? [...list, v] : list.filter((x) => x !== v));

/** Sidebar lọc trang Hóa đơn (thứ tự mục theo KiotViet, chỉ các bộ lọc backend hỗ trợ). */
export function InvoiceFilterSidebar({ value, onChange }: { value: InvoiceFilters; onChange: (f: InvoiceFilters) => void }) {
  const { data: users = [] } = useUserLookup();
  const set = (p: Partial<InvoiceFilters>) => onChange({ ...value, ...p });
  return (
    <FilterSidebar>
      <PeriodFilter value={value.period} onChange={(period) => set({ period })} />
      <FilterSection title="Trạng thái hóa đơn">
        {INVOICE_STATUS_OPTIONS.map(([v, l]) => (
          <CheckOption key={v} checked={value.statuses.includes(v)} onChange={(on) => set({ statuses: toggle(value.statuses, v, on) })}>{l}</CheckOption>))}
      </FilterSection>
      <FilterSection title="Phương thức thanh toán">
        {PAYMENT_METHODS.map((m) => (
          <CheckOption key={m.value} checked={value.methods.includes(m.value)} onChange={(on) => set({ methods: toggle(value.methods, m.value, on) })}>{m.label}</CheckOption>))}
      </FilterSection>
      <FilterSection title="Người tạo">
        <select className={FILTER_FIELD} aria-label="Người tạo" value={value.createdBy} onChange={(e) => set({ createdBy: e.target.value })}>
          <option value="">Chọn người tạo</option>{users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}</select>
      </FilterSection>
      <FilterSection title="Người bán">
        <select className={FILTER_FIELD} aria-label="Người bán" value={value.sellerId} onChange={(e) => set({ sellerId: e.target.value })}>
          <option value="">Chọn người bán</option>{users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}</select>
      </FilterSection>
    </FilterSidebar>
  );
}
