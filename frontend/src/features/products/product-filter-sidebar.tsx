"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { errorMessage } from "@/lib/api-client";
import { useCurrentUser } from "@/lib/use-current-user";
import { cn } from "@/lib/utils";
import { ProductFilterMultiSelect } from "./product-filter-multi-select";
import {
  flattenCategoryTree, promptCreateCategory, useCategories, useTaxRates, type ProductFilters,
} from "./product-queries";
import type { StockFilter } from "./product-types";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { productsNs } from "@/messages/products";

/** Nhãn: t(`filter.stockOptions.${value}`). */
const STOCK_OPTIONS: StockFilter[] = ["ALL", "BELOW_MIN", "ABOVE_MAX", "IN_STOCK", "OUT_OF_STOCK"];

type Props = { filters: ProductFilters; onChange: (f: ProductFilters) => void };

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-bold">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Nhóm nút chọn 1 dạng viên thuốc (Tất cả / Có / Không). */
function Pills<T extends string>({ value, options, onChange }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}
          className={cn("h-7 rounded-full border px-2.5 text-[13px]",
            value === o.value ? "border-primary bg-primary font-semibold text-primary-foreground" : "bg-background hover:bg-muted")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Radio({ checked, label, onSelect }: { checked: boolean; label: string; onSelect: () => void }) {
  return (
    <label className="flex h-8 cursor-pointer items-center gap-2 text-[13px]">
      <input type="radio" className="size-4 accent-primary" checked={checked} onChange={onSelect} />
      {label}
    </label>
  );
}

/** "Toàn thời gian" / "Tùy chỉnh" + chọn khoảng ngày (yyyy-mm-dd, "" = không lọc). */
function DateRangeRadio({ from, to, onChange }: { from: string; to: string; onChange: (r: { from: string; to: string }) => void }) {
  const [custom, setCustom] = useState(!!(from || to));
  const t = useT(productsNs);
  const tc = useT(commonNs);
  return (
    <div>
      <Radio label={t("filter.allTime")} checked={!custom} onSelect={() => { setCustom(false); onChange({ from: "", to: "" }); }} />
      <Radio label={tc("calendar.custom")} checked={custom} onSelect={() => setCustom(true)} />
      {custom && (
        <div className="mt-1">
          <DateRangePicker placeholder={tc("calendar.pickRange")} value={{ from, to }} onChange={(r) => onChange({ from: r.from, to: r.to })} />
        </div>
      )}
    </div>
  );
}

export function ProductFilterSidebar({ filters, onChange }: Props) {
  const qc = useQueryClient();
  const { can } = useCurrentUser();
  const { data: categories = [] } = useCategories();
  const { data: taxRates = [] } = useTaxRates();
  const set = (patch: Partial<ProductFilters>) => onChange({ ...filters, ...patch });
  const t = useT(productsNs);
  const tc = useT(commonNs);
  const stockOptions = STOCK_OPTIONS.map((value) => ({ value, label: t(`filter.stockOptions.${value}`) }));

  async function createCategory() {
    try { await promptCreateCategory(qc, t("form.promptNewCategory")); } catch (e) { toast.error(errorMessage(e)); }
  }

  return (
    <aside className="w-[200px] shrink-0 space-y-4 rounded-lg bg-background p-2.5">
      <Section title={t("fields.category")} action={can("catalog.manage") && (
        <button type="button" className="text-[13px] text-primary hover:underline" onClick={createCategory}>{t("form.createNew")}</button>
      )}>
        <ProductFilterMultiSelect placeholder={t("filter.pickCategory")} options={flattenCategoryTree(categories)}
          value={filters.categoryIds} onChange={(categoryIds) => set({ categoryIds })} />
      </Section>
      <Section title={t("fields.taxRate")}>
        <ProductFilterMultiSelect placeholder={t("filter.pickTaxRate")} options={taxRates}
          value={filters.taxRateIds} onChange={(taxRateIds) => set({ taxRateIds })} />
      </Section>
      <Section title={t("fields.taxReduction")}>
        <Pills value={filters.taxReduction} onChange={(v) => set({ taxReduction: v })}
          options={[{ value: "all", label: tc("status.all") }, { value: "yes", label: tc("status.yes") }, { value: "no", label: tc("status.no") }]} />
      </Section>
      <Section title={t("fields.stock")}>
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">{t("filter.stockCriteria")}</div>
          <Select value={filters.stock} items={stockOptions}
            onValueChange={(v) => set({ stock: (v ?? "ALL") as StockFilter })}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {stockOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Section>
      <Section title={t("filter.createdTime")}>
        <DateRangeRadio from={filters.createdFrom} to={filters.createdTo}
          onChange={(r) => set({ createdFrom: r.from, createdTo: r.to })} />
      </Section>
      <Section title={t("fields.expectedOut")}>
        <DateRangeRadio from={filters.expectedOutFrom} to={filters.expectedOutTo}
          onChange={(r) => set({ expectedOutFrom: r.from, expectedOutTo: r.to })} />
      </Section>
      <Section title={t("filter.productStatus")}>
        <Pills value={filters.active} onChange={(v) => set({ active: v })}
          options={[{ value: "yes", label: t("detail.selling") }, { value: "no", label: t("detail.discontinued") },
            { value: "all", label: tc("status.all") }]} />
      </Section>
    </aside>
  );
}
