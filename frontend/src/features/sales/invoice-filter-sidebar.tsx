"use client";

import { useUserLookup } from "@/features/purchases/purchase-queries";
import { useT } from "@/lib/i18n";
import { salesNs } from "@/messages/sales";
import { CheckOption, FILTER_FIELD, FilterSection, FilterSidebar } from "./invoice-list-kit";
import { enumLabel } from "./i18n-enum-label";
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
  const t = useT(salesNs);
  const { data: users = [] } = useUserLookup();
  const einvoiceText = (csv: string) => csv.split(",").map((s) => enumLabel(t, salesNs, "enums.einvoiceState", s)).join(", ");
  const set = (p: Partial<InvoiceFilters>) => onChange({ ...value, ...p });
  return (
    <FilterSidebar>
      <InvoiceTimeFilter value={value.time} onChange={(time) => set({ time })} />
      <FilterSection title={t("invoices.filter.delivery")}>
        <Checks options={[["NONE", t("invoices.filter.noDelivery")], ["DELIVERY", t("invoices.filter.withDelivery")]]} value={value.deliveries} onChange={(deliveries) => set({ deliveries })} />
      </FilterSection>
      <FilterSection title={t("invoices.filter.invoiceState")}>
        <Checks options={STATE_OPTIONS.map(([v]) => [v, t(`enums.invoiceState.${v}`)] as const)} value={value.states} onChange={(states) => set({ states })} />
      </FilterSection>
      <FilterSection title={t("invoices.filter.returnState")}>
        <Checks options={[["NONE", t("invoices.filter.noReturn")], ["HAS", t("invoices.filter.hasReturn")]]} value={value.returnStates} onChange={(returnStates) => set({ returnStates })} />
      </FilterSection>
      <FilterSection title={t("invoices.filter.einvoiceStatus")}>
        <select className={FILTER_FIELD} aria-label={t("invoices.filter.einvoiceStatus")} value={value.einvoiceStatus} onChange={(e) => set({ einvoiceStatus: e.target.value })}>
          <option value="">{t("invoices.filter.pickStatus")}</option>
          {value.einvoiceStatus.includes(",") && <option value={value.einvoiceStatus}>{einvoiceText(value.einvoiceStatus)}</option>}
          {EINVOICE_STATE_OPTIONS.map(([v]) => <option key={v} value={v}>{t(`enums.einvoiceState.${v}`)}</option>)}</select>
      </FilterSection>
      <FilterSection title={t("invoices.filter.nature")}>
        <select className={FILTER_FIELD} aria-label={t("invoices.filter.nature")} value={value.einvoiceNature} onChange={(e) => set({ einvoiceNature: e.target.value })}>
          <option value="">{t("invoices.filter.pickStatus")}</option>{NATURE_OPTIONS.map(([v]) => <option key={v} value={v}>{t(`enums.einvoiceNature.${v}`)}</option>)}</select>
      </FilterSection>
      <FilterSection title={t("invoices.filter.paymentMethod")}>
        <Checks options={PAYMENT_METHODS.map((m) => [m.value as string, t(`enums.paymentMethod.${m.value}`)] as const)} value={value.methods} onChange={(methods) => set({ methods })} />
      </FilterSection>
      <FilterSection title={t("invoices.filter.createdBy")}>
        <select className={FILTER_FIELD} aria-label={t("invoices.filter.createdBy")} value={value.createdBy} onChange={(e) => set({ createdBy: e.target.value })}>
          <option value="">{t("invoices.filter.pickCreator")}</option>{users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}</select>
      </FilterSection>
      <FilterSection title={t("invoices.filter.seller")}>
        <select className={FILTER_FIELD} aria-label={t("invoices.filter.seller")} value={value.sellerId} onChange={(e) => set({ sellerId: e.target.value })}>
          <option value="">{t("invoices.filter.pickSeller")}</option>{users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}</select>
      </FilterSection>
    </FilterSidebar>
  );
}
