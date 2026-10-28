"use client";

import { CheckOption, FILTER_FIELD, FilterSection, FilterSidebar, PeriodFilter } from "@/features/sales/invoice-list-kit";
import type { Period } from "@/features/sales/sales-queries";
import { useBuyerTaxCodes } from "./integration-queries";
import { useT } from "@/lib/i18n";
import { purchasesNs } from "@/messages/purchases";

export type InputInvoiceFilters = { period: Period; buyer: string; seller: string; statuses: string[] };

const STATUSES = [["NOT_CREATED", "inputInvoices.filter.notCreated"], ["CREATED", "inputInvoices.filter.created"]] as const;

const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);

/** Chuyển bộ lọc sang query /input-invoices (ngày dạng yyyy-mm-dd, bao gồm 2 đầu; 1 trạng thái → receiptStatus). */
export function inputInvoiceParams(f: InputInvoiceFilters, params: URLSearchParams) {
  if (f.period.mode === "month") { const n = new Date(); params.set("from", iso(new Date(n.getFullYear(), n.getMonth(), 1))); }
  if (f.period.mode === "custom") {
    if (f.period.from) params.set("from", f.period.from);
    if (f.period.to) params.set("to", f.period.to);
  }
  if (f.buyer) params.set("buyerTaxCode", f.buyer);
  if (f.seller) params.set("seller", f.seller);
  if (f.statuses.length === 1) params.set("receiptStatus", f.statuses[0]);
  return params;
}

export function InputInvoiceFilterSidebar({ value, onChange }: { value: InputInvoiceFilters; onChange: (f: InputInvoiceFilters) => void }) {
  const { data: buyers = [] } = useBuyerTaxCodes();
  const t = useT(purchasesNs);
  const set = (p: Partial<InputInvoiceFilters>) => onChange({ ...value, ...p });
  const toggle = (v: string, on: boolean) => set({ statuses: on ? [...value.statuses, v] : value.statuses.filter((x) => x !== v) });
  return (
    <FilterSidebar>
      <PeriodFilter allowAll value={value.period} onChange={(period) => set({ period })} />
      <FilterSection title={t("inputInvoices.filter.taxCode")}>
        <select className={FILTER_FIELD} aria-label={t("inputInvoices.filter.buyerTaxCode")} value={value.buyer} onChange={(e) => set({ buyer: e.target.value })}>
          <option value="">{t("inputInvoices.filter.pickTaxCode")}</option>{buyers.filter(Boolean).map((b) => <option key={b}>{b}</option>)}</select>
      </FilterSection>
      <FilterSection title={t("inputInvoices.filter.supplier")}>
        <input className={FILTER_FIELD} placeholder={t("inputInvoices.filter.sellerPlaceholder")} aria-label={t("inputInvoices.filter.supplier")} value={value.seller}
          onChange={(e) => set({ seller: e.target.value })} />
      </FilterSection>
      <FilterSection title={t("inputInvoices.filter.receiptStatus")}>
        {STATUSES.map(([v, l]) => <CheckOption key={v} checked={value.statuses.includes(v)} onChange={(on) => toggle(v, on)}>{t(l)}</CheckOption>)}
      </FilterSection>
    </FilterSidebar>
  );
}
