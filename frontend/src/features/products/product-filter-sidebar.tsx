"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { errorMessage } from "@/lib/api-client";
import { useCurrentUser } from "@/lib/use-current-user";
import { cn } from "@/lib/utils";
import { ProductFilterMultiSelect } from "./product-filter-multi-select";
import {
  flattenCategoryTree, promptCreateCategory, useCategories, useTaxRates, type ProductFilters,
} from "./product-queries";
import type { StockFilter } from "./product-types";

const STOCK_OPTIONS: { value: StockFilter; label: string }[] = [
  { value: "ALL", label: "Tất cả" },
  { value: "BELOW_MIN", label: "Dưới định mức tồn" },
  { value: "ABOVE_MAX", label: "Vượt định mức tồn" },
  { value: "IN_STOCK", label: "Còn hàng trong kho" },
  { value: "OUT_OF_STOCK", label: "Hết hàng trong kho" },
];

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

export function ProductFilterSidebar({ filters, onChange }: Props) {
  const qc = useQueryClient();
  const { can } = useCurrentUser();
  const { data: categories = [] } = useCategories();
  const { data: taxRates = [] } = useTaxRates();
  const set = (patch: Partial<ProductFilters>) => onChange({ ...filters, ...patch });
  const [customTime, setCustomTime] = useState(!!(filters.createdFrom || filters.createdTo));

  async function createCategory() {
    try { await promptCreateCategory(qc); } catch (e) { toast.error(errorMessage(e)); }
  }

  return (
    <aside className="w-[200px] shrink-0 space-y-4 rounded-lg bg-background p-2.5">
      <Section title="Nhóm hàng" action={can("catalog.manage") && (
        <button type="button" className="text-[13px] text-primary hover:underline" onClick={createCategory}>Tạo mới</button>
      )}>
        <ProductFilterMultiSelect placeholder="Chọn nhóm hàng" options={flattenCategoryTree(categories)}
          value={filters.categoryIds} onChange={(categoryIds) => set({ categoryIds })} />
      </Section>
      <Section title="Tỷ lệ tính thuế">
        <ProductFilterMultiSelect placeholder="Chọn thuế suất" options={taxRates}
          value={filters.taxRateIds} onChange={(taxRateIds) => set({ taxRateIds })} />
      </Section>
      <Section title="Áp dụng giảm thuế">
        <Pills value={filters.taxReduction} onChange={(v) => set({ taxReduction: v })}
          options={[{ value: "all", label: "Tất cả" }, { value: "yes", label: "Có" }, { value: "no", label: "Không" }]} />
      </Section>
      <Section title="Tồn kho">
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Tiêu chí tồn</div>
          <Select value={filters.stock} items={STOCK_OPTIONS}
            onValueChange={(v) => set({ stock: (v ?? "ALL") as StockFilter })}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STOCK_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Section>
      <Section title="Thời gian tạo">
        <div>
          <Radio label="Toàn thời gian" checked={!customTime}
            onSelect={() => { setCustomTime(false); set({ createdFrom: "", createdTo: "" }); }} />
          <Radio label="Tùy chỉnh" checked={customTime} onSelect={() => setCustomTime(true)} />
          {customTime && (
            <div className="mt-1 grid gap-1.5 text-xs text-muted-foreground">
              <label className="grid gap-1">Từ ngày
                <Input type="date" value={filters.createdFrom} onChange={(e) => set({ createdFrom: e.target.value })} />
              </label>
              <label className="grid gap-1">Đến ngày
                <Input type="date" value={filters.createdTo} onChange={(e) => set({ createdTo: e.target.value })} />
              </label>
            </div>
          )}
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
