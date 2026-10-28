"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { flattenCategoryTree, useCategories, useTaxRates, type ProductFilters } from "./product-queries";
import type { StockFilter } from "./product-types";

const STOCK_OPTIONS: { value: StockFilter; label: string }[] = [
  { value: "ALL", label: "Tất cả" },
  { value: "BELOW_MIN", label: "Dưới định mức tồn" },
  { value: "ABOVE_MAX", label: "Vượt định mức tồn" },
  { value: "IN_STOCK", label: "Còn hàng trong kho" },
  { value: "OUT_OF_STOCK", label: "Hết hàng trong kho" },
];

type Props = { filters: ProductFilters; onChange: (f: ProductFilters) => void };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 border-b pb-4 last:border-0">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

/** Nhóm nút chọn 1 (Tất cả / Có / Không). */
function Pills<T extends string>({ value, options, onChange }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)}
          className={cn("rounded-full border px-3 py-1 text-sm",
            value === o.value ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

const toggle = (list: string[], id: string, on: boolean) => (on ? [...list, id] : list.filter((x) => x !== id));

export function ProductFilterSidebar({ filters, onChange }: Props) {
  const { data: categories = [] } = useCategories();
  const { data: taxRates = [] } = useTaxRates();
  const set = (patch: Partial<ProductFilters>) => onChange({ ...filters, ...patch });

  return (
    <aside className="w-60 shrink-0 space-y-4 rounded-lg bg-background p-4">
      <Section title="Nhóm hàng">
        <div className="max-h-48 space-y-1 overflow-y-auto">
          {flattenCategoryTree(categories).map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-sm" style={{ paddingLeft: c.depth * 14 }}>
              <Checkbox checked={filters.categoryIds.includes(c.id)}
                onCheckedChange={(v) => set({ categoryIds: toggle(filters.categoryIds, c.id, v === true) })} />
              {c.name}
            </label>
          ))}
        </div>
      </Section>
      <Section title="Tỷ lệ tính thuế">
        <div className="max-h-40 space-y-1 overflow-y-auto">
          {taxRates.map((t) => (
            <label key={t.id} className="flex items-start gap-2 text-sm">
              <Checkbox className="mt-0.5" checked={filters.taxRateIds.includes(t.id)}
                onCheckedChange={(v) => set({ taxRateIds: toggle(filters.taxRateIds, t.id, v === true) })} />
              {t.name}
            </label>
          ))}
        </div>
      </Section>
      <Section title="Áp dụng giảm thuế">
        <Pills value={filters.taxReduction} onChange={(v) => set({ taxReduction: v })}
          options={[{ value: "all", label: "Tất cả" }, { value: "yes", label: "Có" }, { value: "no", label: "Không" }]} />
      </Section>
      <Section title="Tồn kho">
        <Select value={filters.stock} items={STOCK_OPTIONS}
          onValueChange={(v) => set({ stock: (v ?? "ALL") as StockFilter })}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STOCK_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </Section>
      <Section title="Thời gian tạo">
        <div className="grid gap-1.5 text-sm">
          <label className="grid gap-1">Từ ngày
            <Input type="date" value={filters.createdFrom} onChange={(e) => set({ createdFrom: e.target.value })} />
          </label>
          <label className="grid gap-1">Đến ngày
            <Input type="date" value={filters.createdTo} onChange={(e) => set({ createdTo: e.target.value })} />
          </label>
        </div>
      </Section>
      <Section title="Trạng thái hàng hóa">
        <Pills value={filters.active} onChange={(v) => set({ active: v })}
          options={[{ value: "yes", label: "Đang kinh doanh" }, { value: "no", label: "Ngừng kinh doanh" },
            { value: "all", label: "Tất cả" }]} />
      </Section>
    </aside>
  );
}
