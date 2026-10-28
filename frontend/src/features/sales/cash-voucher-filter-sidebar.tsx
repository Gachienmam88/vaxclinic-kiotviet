"use client";

import { useUserLookup } from "@/features/purchases/purchase-queries";
import {
  CheckOption, FILTER_FIELD, FilterSection, FilterSidebar, PeriodFilter, PillGroup, RadioOption,
} from "./invoice-list-kit";
import { useCashCategories, type Period } from "./sales-queries";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { cashbookNs } from "@/messages/cashbook";
import { salesNs } from "@/messages/sales";
import { enumLabel } from "./i18n-enum-label";

export type CashFilters = {
  fund: string; period: Period; types: string[]; category: string; statuses: string[]; accounting: string;
  createdBy: string; collectorId: string; partnerType: string; partner: string;
};

/** Loại người nộp/nhận; nhãn: cashbook "enums.partnerType.<giá trị>". */
export const PARTNER_TYPES = ["CUSTOMER", "SUPPLIER", "EMPLOYEE", "DELIVERY_PARTNER", "OTHER"] as const;

const toggle = (list: string[], v: string, on: boolean) => (on ? [...list, v] : list.filter((x) => x !== v));

/** Sidebar lọc Sổ quỹ (thứ tự theo KiotViet; chỉ các bộ lọc backend /cashbook hỗ trợ). */
export function CashVoucherFilterSidebar({ value, onChange }: { value: CashFilters; onChange: (f: CashFilters) => void }) {
  const t = useT(cashbookNs);
  const tc = useT(commonNs);
  const ts = useT(salesNs);
  const { data: users = [] } = useUserLookup();
  const { data: categories = [] } = useCashCategories();
  const set = (p: Partial<CashFilters>) => onChange({ ...value, ...p });
  return (
    <FilterSidebar>
      <FilterSection title={t("filter.fund")}>
        {["CASH", "BANK", "EWALLET", "ALL"].map((f) => (
          <RadioOption key={f} checked={value.fund === f} onSelect={() => set({ fund: f })}>{enumLabel(ts, salesNs, "enums.fund", f)}</RadioOption>))}
      </FilterSection>
      <PeriodFilter value={value.period} onChange={(period) => set({ period })} />
      <FilterSection title={t("filter.docType")}>
        {(["RECEIPT", "PAYMENT"] as const).map((v) => (
          <CheckOption key={v} checked={value.types.includes(v)} onChange={(on) => set({ types: toggle(value.types, v, on) })}>{t(`enums.voucherType.${v}`)}</CheckOption>))}
      </FilterSection>
      <FilterSection title={t("filter.category")}>
        <select className={FILTER_FIELD} aria-label={t("filter.category")} value={value.category} onChange={(e) => set({ category: e.target.value })}>
          <option value="">{t("filter.pickCategory")}</option>{categories.map((c) => <option key={c}>{c}</option>)}</select>
      </FilterSection>
      <FilterSection title={t("filter.status")}>
        {(["PAID", "CANCELLED"] as const).map((v) => (
          <CheckOption key={v} checked={value.statuses.includes(v)} onChange={(on) => set({ statuses: toggle(value.statuses, v, on) })}>{t(`enums.status.${v}`)}</CheckOption>))}
      </FilterSection>
      <FilterSection title={t("filter.accounting")}>
        <PillGroup value={value.accounting} onChange={(accounting) => set({ accounting })}
          options={[["", tc("status.all")], ["true", tc("status.yes")], ["false", tc("status.no")]]} />
      </FilterSection>
      <FilterSection title={t("filter.createdBy")}>
        <select className={FILTER_FIELD} aria-label={t("filter.createdBy")} value={value.createdBy} onChange={(e) => set({ createdBy: e.target.value })}>
          <option value="">{t("filter.pickCreator")}</option>{users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}</select>
      </FilterSection>
      <FilterSection title={t("filter.employee")}>
        <select className={FILTER_FIELD} aria-label={t("filter.employeeAria")} value={value.collectorId} onChange={(e) => set({ collectorId: e.target.value })}>
          <option value="">{t("filter.pickEmployee")}</option>{users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}</select>
      </FilterSection>
      <FilterSection title={t("filter.partner")}>
        <select className={FILTER_FIELD} aria-label={t("filter.partnerTypeAria")} value={value.partnerType} onChange={(e) => set({ partnerType: e.target.value })}>
          <option value="">{tc("status.all")}</option>{PARTNER_TYPES.map((v) => <option key={v} value={v}>{t(`enums.partnerType.${v}`)}</option>)}</select>
        <input className={FILTER_FIELD} placeholder={t("filter.partnerPlaceholder")} aria-label={t("filter.partnerAria")}
          value={value.partner} onChange={(e) => set({ partner: e.target.value })} />
      </FilterSection>
    </FilterSidebar>
  );
}
