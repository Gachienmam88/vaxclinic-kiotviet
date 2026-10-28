"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckOption, FILTER_FIELD, FilterSection, FilterSidebar, PeriodFilter, RadioOption } from "@/features/sales/invoice-list-kit";
import type { DeepLink } from "@/components/ui/deep-link-route";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { periodParams, type Period } from "@/features/sales/sales-queries";
import { useT } from "@/lib/i18n";
import { useVnAdmin } from "@/lib/vn-admin-data";
import { commonNs } from "@/messages/common";
import { deliveryNs } from "@/messages/delivery";
import { usePartnerOptions } from "./delivery-queries";
import { SHIPMENT_STATUS_KEY, SHIPMENT_STATUSES } from "./delivery-types";

/** province: mã tỉnh + tên rút gọn (khớp vận đơn cũ chưa có mã theo tên khu vực). */
export type ShipmentFilters = {
  period: Period; partnerId: string; provinceCode: string; provinceShortName: string; statuses: string[]; reconciled: "" | "true" | "false";
};

const toggle = (list: string[], v: string, on: boolean) => (on ? [...list, v] : list.filter((x) => x !== v));

/**
 * Trạng thái bộ lọc + trang + tìm kiếm của danh sách vận đơn → query string GET /shipments.
 * Link sâu (?code=VD…): tìm theo mã, mọi thời gian + trạng thái.
 */
export function useShipmentListState(defaultStatuses: string[] = [], link?: DeepLink) {
  const deepLink = !!(link?.code || link?.id);
  const statuses = deepLink ? [] : defaultStatuses;
  const [search, setSearch] = useState(link?.code ?? "");
  const [q, setQ] = useState(link?.code ?? "");
  const [filters, setFiltersRaw] = useState<ShipmentFilters>({ period: { mode: deepLink ? "all" : "month", from: "", to: "" }, partnerId: "", provinceCode: "", provinceShortName: "",
    statuses, reconciled: "" });
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(15);
  useEffect(() => { const t = setTimeout(() => { setQ(search); setPage(0); }, 300); return () => clearTimeout(t); }, [search]);
  const params = useMemo(() => {
    const p = periodParams(filters.period, new URLSearchParams({ page: String(page), size: String(size) }));
    if (q) p.set("q", q);
    if (filters.partnerId) p.set("partnerId", filters.partnerId);
    if (filters.provinceCode) {
      p.set("provinceCode", filters.provinceCode);
      if (filters.provinceShortName) p.set("area", filters.provinceShortName);
    }
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
  const t = useT(deliveryNs);
  const tc = useT(commonNs);
  const { data: partners = [] } = usePartnerOptions();
  const vn = useVnAdmin();
  const set = (p: Partial<ShipmentFilters>) => onChange({ ...value, ...p });
  return (
    <FilterSidebar>
      {showStatuses && (
        <FilterSection title={t("filter.deliveryStatus")}>
          {SHIPMENT_STATUSES.map(([v]) => (
            <CheckOption key={v} checked={value.statuses.includes(v)} onChange={(on) => set({ statuses: toggle(value.statuses, v, on) })}>{t(SHIPMENT_STATUS_KEY[v])}</CheckOption>))}
        </FilterSection>)}
      <PeriodFilter value={value.period} onChange={(period) => set({ period })} allowAll />
      <FilterSection title={t("fields.partner")}>
        <select className={FILTER_FIELD} aria-label={t("fields.partner")} value={value.partnerId} onChange={(e) => set({ partnerId: e.target.value })}>
          <option value="">{t("filter.allPartners")}</option>{partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
      </FilterSection>
      <FilterSection title={t("filter.area")}>
        <SearchableSelect aria-label={t("filter.area")} className={FILTER_FIELD} options={vn?.provinces ?? []}
          value={value.provinceCode} placeholder={t("filter.allProvinces")} searchPlaceholder={t("filter.searchProvince")}
          onChange={(p) => set({ provinceCode: p?.code ?? "",
            provinceShortName: p ? p.name.replace(new RegExp(`^${p.type} `), "") : "" })} />
      </FilterSection>
      <FilterSection title={t("fields.reconcile")}>
        {([["", tc("status.all")], ["false", t("filter.notReconciled")], ["true", t("filter.reconciled")]] as const).map(([v, l]) => (
          <RadioOption key={v} checked={value.reconciled === v} onSelect={() => set({ reconciled: v })}>{l}</RadioOption>))}
      </FilterSection>
    </FilterSidebar>
  );
}
