"use client";

import { CheckOption, FILTER_FIELD, FilterSection, FilterSidebar, PeriodFilter } from "@/features/sales/invoice-list-kit";
import type { Period } from "@/features/sales/sales-queries";
import { useBuyerTaxCodes, useInputInvoiceSellers } from "./integration-queries";
import { useT } from "@/lib/i18n";
import { inputInvoicesNs } from "@/messages/input-invoices";

/** seller = MST người bán ("" = tất cả); nature = ORIGINAL / REPLACE / ADJUST ("" = tất cả); statuses: CREATED / NOT_CREATED. */
export type InputInvoiceFilters = { period: Period; buyer: string; seller: string; nature: string; statuses: string[] };

export const DEFAULT_INPUT_INVOICE_FILTERS: InputInvoiceFilters = {
  period: { mode: "month", from: "", to: "" }, buyer: "", seller: "", nature: "", statuses: ["NOT_CREATED", "CREATED"],
};

const STATUSES = [["NOT_CREATED", "filter.notCreated"], ["CREATED", "filter.created"]] as const;
const NATURES = [["ORIGINAL", "nature.original"], ["REPLACE", "nature.replace"], ["ADJUST", "nature.adjust"]] as const;

const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);

/** Bộ lọc → query /input-invoices (ngày yyyy-mm-dd, gồm 2 đầu). Trạng thái: chọn 1 → receiptStatus; chọn cả 2 / không chọn → tất cả. */
export function inputInvoiceParams(f: InputInvoiceFilters, params = new URLSearchParams()) {
  if (f.period.mode === "month") {
    const n = new Date();
    params.set("from", iso(new Date(n.getFullYear(), n.getMonth(), 1)));
    params.set("to", iso(new Date(n.getFullYear(), n.getMonth() + 1, 0)));
  }
  if (f.period.mode === "custom") {
    if (f.period.from) params.set("from", f.period.from);
    if (f.period.to) params.set("to", f.period.to);
  }
  if (f.buyer) params.set("buyerTaxCode", f.buyer);
  if (f.seller) params.set("sellerTaxCode", f.seller);
  if (f.nature) params.append("natures", f.nature);
  if (f.statuses.length === 1) params.set("receiptStatus", f.statuses[0]);
  return params;
}

export function InputInvoiceFilterSidebar({ value, onChange }: { value: InputInvoiceFilters; onChange: (f: InputInvoiceFilters) => void }) {
  const { data: buyers = [] } = useBuyerTaxCodes();
  const { data: sellers = [] } = useInputInvoiceSellers();
  const t = useT(inputInvoicesNs);
  const set = (p: Partial<InputInvoiceFilters>) => onChange({ ...value, ...p });
  const toggle = (v: string, on: boolean) => set({ statuses: on ? [...value.statuses, v] : value.statuses.filter((x) => x !== v) });
  return (
    <FilterSidebar>
      <PeriodFilter value={value.period} onChange={(period) => set({ period })} />
      <FilterSection title={t("filter.taxCode")}>
        <select className={FILTER_FIELD} aria-label={t("filter.taxCode")} value={value.buyer} onChange={(e) => set({ buyer: e.target.value })}>
          <option value="">{t("filter.pickTaxCode")}</option>{buyers.filter(Boolean).map((b) => <option key={b}>{b}</option>)}</select>
      </FilterSection>
      <FilterSection title={t("filter.supplier")}>
        <select className={FILTER_FIELD} aria-label={t("filter.supplier")} value={value.seller} onChange={(e) => set({ seller: e.target.value })}>
          <option value="">{t("filter.allSuppliers")}</option>
          {sellers.map((s) => <option key={s.taxCode} value={s.taxCode}>{s.name ? `${s.name} - ${s.taxCode}` : s.taxCode}</option>)}</select>
      </FilterSection>
      <FilterSection title={t("filter.nature")}>
        <select className={FILTER_FIELD} aria-label={t("filter.nature")} value={value.nature} onChange={(e) => set({ nature: e.target.value })}>
          <option value="">{t("filter.pickNature")}</option>{NATURES.map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}</select>
      </FilterSection>
      <FilterSection title={t("filter.receiptStatus")}>
        {STATUSES.map(([v, l]) => <CheckOption key={v} checked={value.statuses.includes(v)} onChange={(on) => toggle(v, on)}>{t(l)}</CheckOption>)}
      </FilterSection>
    </FilterSidebar>
  );
}
