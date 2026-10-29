"use client";

import { useEffect, useMemo, useState } from "react";
import { SearchableSelect } from "@/components/ui/searchable-select";
import type { DeepLink } from "@/components/ui/deep-link-route";
import { addDays } from "@/features/dashboard/dashboard-date-utils";
import { timeRange } from "@/features/reports/report-time-presets";
import type { InvoiceTime } from "@/features/sales/invoice-filter-model";
import { FILTER_FIELD, FilterSection, FilterSidebar, PillGroup } from "@/features/sales/invoice-list-kit";
import { InvoiceTimeFilter } from "@/features/sales/invoice-time-filter";
import { useT } from "@/lib/i18n";
import { useVnAdmin } from "@/lib/vn-admin-data";
import { deliveryNs } from "@/messages/delivery";
import { usePartnerOptions } from "./delivery-queries";
import { ShipmentStatusSelect } from "./shipment-status-select";

/** Bộ lọc Vận đơn (KiotViet): trạng thái, đối tác, thời gian tạo / hoàn thành, khu vực (tỉnh), thu hộ có / không. */
export type ShipmentFilters = {
  statuses: string[]; partnerId: string; created: InvoiceTime; completed: InvoiceTime; provinceCode: string; provinceShortName: string;
  cod: "" | "true" | "false"; connection: string;
};

const DEFAULT: ShipmentFilters = { statuses: [], partnerId: "", created: { mode: "preset", preset: "thisMonth" }, completed: { mode: "all" },
  provinceCode: "", provinceShortName: "", cod: "", connection: "" };

/** Thời gian → [from, to) ISO (ngày địa phương, to = đầu ngày kế tiếp); "all" → không lọc. */
function setRange(p: URLSearchParams, v: InvoiceTime, fromKey: string, toKey: string) {
  if (v.mode === "all" || (v.mode === "custom" && (!v.from || !v.to))) return;
  const r = timeRange(v);
  p.set(fromKey, r.from.toISOString());
  p.set(toKey, addDays(r.to, 1).toISOString());
}

/**
 * Trạng thái bộ lọc + trang + tìm kiếm → query GET /shipments. Link sâu ?code=VD… → mọi thời gian. initial: bộ lọc mở từ
 * Quản lý giao hàng ("Xem chi tiết": trạng thái, đối tác, khoảng ngày tạo, hình thức kết nối).
 */
export function useShipmentListState(link?: DeepLink, initial?: Partial<ShipmentFilters>) {
  const deepLink = !!(link?.code || link?.id);
  const [search, setSearch] = useState(link?.code ?? "");
  const [q, setQ] = useState(link?.code ?? "");
  const [filters, setFiltersRaw] = useState<ShipmentFilters>({ ...DEFAULT, ...(deepLink ? { created: { mode: "all" } } : {}), ...initial });
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(15);
  useEffect(() => { const t = setTimeout(() => { setQ(search); setPage(0); }, 300); return () => clearTimeout(t); }, [search]);
  const params = useMemo(() => {
    const p = new URLSearchParams({ page: String(page), size: String(size) });
    setRange(p, filters.created, "from", "to");
    setRange(p, filters.completed, "completedFrom", "completedTo");
    if (q) p.set("q", q);
    if (filters.partnerId) p.set("partnerId", filters.partnerId);
    if (filters.provinceCode) {
      p.set("provinceCode", filters.provinceCode);
      if (filters.provinceShortName) p.set("area", filters.provinceShortName);
    }
    if (filters.cod) p.set("cod", filters.cod);
    if (filters.connection) p.set("connection", filters.connection);
    filters.statuses.forEach((s) => p.append("statuses", s));
    return p;
  }, [q, filters, page, size]);
  const setFilters = (f: ShipmentFilters) => { setFiltersRaw(f); setPage(0); };
  return { search, setSearch, filters, setFilters, page, setPage, size, setSize: (n: number) => { setSize(n); setPage(0); }, params };
}

export function ShipmentFilterSidebar({ value, onChange }: { value: ShipmentFilters; onChange: (f: ShipmentFilters) => void }) {
  const t = useT(deliveryNs);
  const { data: partners = [] } = usePartnerOptions();
  const vn = useVnAdmin();
  const set = (p: Partial<ShipmentFilters>) => onChange({ ...value, ...p });
  const COD = [["", t("kv.common.all")], ["true", t("kv.common.yes")], ["false", t("kv.common.no")]] as const;
  return (
    <FilterSidebar>
      <FilterSection title={t("filter.deliveryStatus")}>
        <ShipmentStatusSelect value={value.statuses} onChange={(statuses) => set({ statuses })} placeholder={t("kv.list.pickStatus")} />
      </FilterSection>
      <FilterSection title={t("fields.partner")}>
        <select className={FILTER_FIELD} aria-label={t("fields.partner")} value={value.partnerId} onChange={(e) => set({ partnerId: e.target.value })}>
          <option value="">{t("kv.list.pickPartner")}</option>{partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
      </FilterSection>
      <InvoiceTimeFilter title={t("kv.list.createdTime")} value={value.created} onChange={(created) => set({ created })} />
      <InvoiceTimeFilter title={t("kv.list.completedTime")} value={value.completed} onChange={(completed) => set({ completed })} />
      <FilterSection title={t("kv.list.area")}>
        <SearchableSelect aria-label={t("kv.list.area")} className={FILTER_FIELD} options={vn?.provinces ?? []}
          value={value.provinceCode} placeholder={t("kv.list.areaPh")} searchPlaceholder={t("filter.searchProvince")}
          onChange={(p) => set({ provinceCode: p?.code ?? "", provinceShortName: p ? p.name.replace(new RegExp(`^${p.type} `), "") : "" })} />
      </FilterSection>
      <FilterSection title={t("kv.list.cod")}>
        <PillGroup value={value.cod} options={COD} onChange={(cod) => set({ cod: cod as ShipmentFilters["cod"] })} />
      </FilterSection>
    </FilterSidebar>
  );
}
