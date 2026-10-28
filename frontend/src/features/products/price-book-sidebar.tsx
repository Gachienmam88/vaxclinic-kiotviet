"use client";

import { Pencil, Plus } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useCurrentUser } from "@/lib/use-current-user";
import { ProductFilterMultiSelect } from "./product-filter-multi-select";
import { flattenCategoryTree, useCategories } from "./product-queries";
import type { PriceBook, PriceRowFilters } from "./price-book-types";

const STOCK_OPTIONS = [
  { value: "ALL", label: "Tất cả" },
  { value: "BELOW_MIN", label: "Dưới định mức tồn" },
  { value: "ABOVE_MAX", label: "Vượt định mức tồn" },
  { value: "IN_STOCK", label: "Còn hàng trong kho" },
  { value: "OUT_OF_STOCK", label: "Hết hàng trong kho" },
];

type Props = {
  books: PriceBook[];
  selected: string[];
  onSelect: (ids: string[]) => void;
  onCreate: () => void;
  onEdit: (b: PriceBook) => void;
  filters: PriceRowFilters;
  onFilters: (f: PriceRowFilters) => void;
};

const Title = ({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) => (
  <div className="flex items-center justify-between"><h3 className="text-[13px] font-bold">{children}</h3>{action}</div>
);

/** Cột lọc trái: chọn nhiều bảng giá (+ tạo, bút sửa từng bảng), nhóm hàng, tồn kho. */
export function PriceBookSidebar({ books, selected, onSelect, onCreate, onEdit, filters, onFilters }: Props) {
  const { can } = useCurrentUser();
  const { data: categories = [] } = useCategories();
  const manage = can("catalog.manage");
  const set = (patch: Partial<PriceRowFilters>) => onFilters({ ...filters, ...patch });
  const expired = (b: PriceBook) => Date.parse(b.validTo) < Date.now();

  return (
    <aside className="w-[200px] shrink-0 space-y-4 rounded-lg bg-background p-2.5">
      <section className="space-y-2">
        <Title action={manage && (
          <button type="button" aria-label="Thêm bảng giá" title="Thêm bảng giá" className="text-primary" onClick={onCreate}>
            <Plus className="size-4" />
          </button>
        )}>Bảng giá</Title>
        {!books.length && <p className="text-xs text-muted-foreground">Chưa có bảng giá. Bấm + để thêm.</p>}
        <ul className="max-h-72 space-y-0.5 overflow-y-auto">
          {books.map((b) => (
            <li key={b.id} className="group flex items-center gap-2 rounded px-1 py-1 text-[13px] hover:bg-muted">
              <Checkbox checked={selected.includes(b.id)} aria-label={b.name}
                onCheckedChange={(on) => onSelect(on ? [...selected, b.id] : selected.filter((x) => x !== b.id))} />
              <span className="min-w-0 flex-1 truncate" title={b.name}>
                {b.name}
                {(!b.active || expired(b)) && (
                  <span className="ml-1 text-xs text-muted-foreground">({expired(b) ? "hết hạn" : "chưa áp dụng"})</span>
                )}
              </span>
              {manage && (
                <button type="button" aria-label={`Sửa ${b.name}`} title="Sửa bảng giá"
                  className="text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-primary focus-visible:opacity-100"
                  onClick={() => onEdit(b)}>
                  <Pencil className="size-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
        <label className="flex items-center gap-2 text-[13px]">
          <Checkbox checked={filters.inBookOnly} disabled={!selected.length}
            onCheckedChange={(v) => set({ inBookOnly: v === true })} />
          Chỉ hàng có trong bảng giá
        </label>
      </section>
      <section className="space-y-2">
        <Title>Nhóm hàng</Title>
        <ProductFilterMultiSelect placeholder="Chọn nhóm hàng" options={flattenCategoryTree(categories)}
          value={filters.categoryIds} onChange={(categoryIds) => set({ categoryIds })} />
      </section>
      <section className="space-y-2">
        <Title>Tồn kho</Title>
        <select aria-label="Tiêu chí tồn" value={filters.stock} onChange={(e) => set({ stock: e.target.value })}
          className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm">
          {STOCK_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </section>
    </aside>
  );
}
