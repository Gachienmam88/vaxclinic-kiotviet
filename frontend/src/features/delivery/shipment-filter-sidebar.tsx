"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckOption, FILTER_FIELD, FilterSection, FilterSidebar, PeriodFilter, RadioOption } from "@/features/sales/invoice-list-kit";
import { periodParams, type Period } from "@/features/sales/sales-queries";
import { usePartnerOptions } from "./delivery-queries";
import { SHIPMENT_STATUSES } from "./delivery-types";

export type ShipmentFilters = { period: Period; partnerId: string; area: string; statuses: string[]; reconciled: "" | "true" | "false" };

const toggle = (list: string[], v: string, on: boolean) => (on ? [...list, v] : list.filter((x) => x !== v));

/** Trạng thái bộ lọc + trang + tìm kiếm của danh sách vận đơn → query string GET /shipments. */
export function useShipmentListState(statuses: string[] = []) {
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [filters, setFiltersRaw] = useState<ShipmentFilters>({ period: { mode: "month", from: "", to: "" }, partnerId: "", area: "",
    statuses, reconciled: "" });
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(15);
  useEffect(() => { const t = setTimeout(() => { setQ(search); setPage(0); }, 300); return () => clearTimeout(t); }, [search]);
  const params = useMemo(() => {
    const p = periodParams(filters.period, new URLSearchParams({ page: String(page), size: String(size) }));
    if (q) p.set("q", q);
    if (filters.partnerId) p.set("partnerId", filters.partnerId);
    if (filters.area.trim()) p.set("area", filters.area.trim());
    if (filters.reconciled) p.set("reconciled", filters.reconciled);
    filters.statuses.forEach((s) => p.append("statuses", s));
    return p;
  }, [q, filters, page, size]);
  const setFilters = (f: ShipmentFilters) => { setFiltersRaw(f); setPage(0); };
  return { search, setSearch, filters, setFilters, page, setPage, size, setSize: (n: number) => { setSize(n); setPage(0); }, params };
}

/** Bộ lọc trái: Thời gian (tạo vận đơn), Đối tác giao hàng, Khu vực, Trạng thái (tùy trang), Đối soát. */
export function ShipmentFilterSidebar({ value, onChange, showStatuses }: {
  value: ShipmentFilters; onChange: (f: ShipmentFilters) => void; showStatuses?: boolean;
}) {
  const { data: partners = [] } = usePartnerOptions();
  const set = (p: Partial<ShipmentFilters>) => onChange({ ...value, ...p });
  return (
    <FilterSidebar>
      {showStatuses && (
        <FilterSection title="Trạng thái giao hàng">
          {SHIPMENT_STATUSES.map(([v, l]) => (
            <CheckOption key={v} checked={value.statuses.includes(v)} onChange={(on) => set({ statuses: toggle(value.statuses, v, on) })}>{l}</CheckOption>))}
        </FilterSection>)}
      <PeriodFilter value={value.period} onChange={(period) => set({ period })} allowAll />
      <FilterSection title="Đối tác giao hàng">
        <select className={FILTER_FIELD} aria-label="Đối tác giao hàng" value={value.partnerId} onChange={(e) => set({ partnerId: e.target.value })}>
          <option value="">Tất cả đối tác</option>{partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
      </FilterSection>
      <FilterSection title="Khu vực giao hàng">
        <input className={FILTER_FIELD} aria-label="Khu vực giao hàng" placeholder="Tỉnh/TP, Quận/Huyện" value={value.area}
          onChange={(e) => set({ area: e.target.value })} />
      </FilterSection>
      <FilterSection title="Đối soát">
        {([["", "Tất cả"], ["false", "Chưa đối soát"], ["true", "Đã đối soát"]] as const).map(([v, l]) => (
          <RadioOption key={v} checked={value.reconciled === v} onSelect={() => set({ reconciled: v })}>{l}</RadioOption>))}
      </FilterSection>
    </FilterSidebar>
  );
}
