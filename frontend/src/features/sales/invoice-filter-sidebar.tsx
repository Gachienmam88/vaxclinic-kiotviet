"use client";

import { useUserLookup } from "@/features/purchases/purchase-queries";
import { CheckOption, FILTER_FIELD, FilterSection, FilterSidebar } from "./invoice-list-kit";
import { EINVOICE_STATE_OPTIONS } from "./invoice-einvoice-state";
import { NATURE_OPTIONS, STATE_OPTIONS, type InvoiceFilters } from "./invoice-filter-model";
import { InvoiceTimeFilter } from "./invoice-time-filter";
import { PAYMENT_METHODS } from "./sales-types";

export type { InvoiceFilters } from "./invoice-filter-model";

const toggle = <T extends string>(list: T[], v: T, on: boolean) => (on ? [...list, v] : list.filter((x) => x !== v));

/** Nhóm checkbox (giá trị, nhãn). */
function Checks<T extends string>({ options, value, onChange }: {
  options: readonly (readonly [T, string])[]; value: T[]; onChange: (v: T[]) => void;
}) {
  return options.map(([v, l]) => (
    <CheckOption key={v} checked={value.includes(v)} onChange={(on) => onChange(toggle(value, v, on))}>{l}</CheckOption>));
}

/** Sidebar lọc trang Hóa đơn theo thứ tự KiotViet; mọi bộ lọc chạy ở server (GET /invoices). */
export function InvoiceFilterSidebar({ value, onChange }: { value: InvoiceFilters; onChange: (f: InvoiceFilters) => void }) {
  const { data: users = [] } = useUserLookup();
  const set = (p: Partial<InvoiceFilters>) => onChange({ ...value, ...p });
  return (
    <FilterSidebar>
      <InvoiceTimeFilter value={value.time} onChange={(time) => set({ time })} />
      <FilterSection title="Giao hàng">
        <Checks options={[["NONE", "Không giao hàng"], ["DELIVERY", "Giao hàng"]]} value={value.deliveries} onChange={(deliveries) => set({ deliveries })} />
      </FilterSection>
      <FilterSection title="Trạng thái hóa đơn">
        <Checks options={STATE_OPTIONS} value={value.states} onChange={(states) => set({ states })} />
      </FilterSection>
      <FilterSection title="Trạng thái trả hàng">
        <Checks options={[["NONE", "Không trả hàng"], ["HAS", "Có trả hàng"]]} value={value.returnStates} onChange={(returnStates) => set({ returnStates })} />
      </FilterSection>
      <FilterSection title="Trạng thái HĐĐT">
        <select className={FILTER_FIELD} aria-label="Trạng thái HĐĐT" value={value.einvoiceStatus} onChange={(e) => set({ einvoiceStatus: e.target.value })}>
          <option value="">Chọn trạng thái</option>{EINVOICE_STATE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      </FilterSection>
      <FilterSection title="Tính chất hóa đơn">
        <select className={FILTER_FIELD} aria-label="Tính chất hóa đơn" value={value.einvoiceNature} onChange={(e) => set({ einvoiceNature: e.target.value })}>
          <option value="">Chọn trạng thái</option>{NATURE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      </FilterSection>
      <FilterSection title="Phương thức thanh toán">
        <Checks options={PAYMENT_METHODS.map((m) => [m.value, m.label] as const)} value={value.methods} onChange={(methods) => set({ methods })} />
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
