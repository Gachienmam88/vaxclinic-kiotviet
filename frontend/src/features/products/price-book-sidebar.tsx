"use client";

import { Pencil, Plus } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useCurrentUser } from "@/lib/use-current-user";
import { ProductFilterMultiSelect } from "./product-filter-multi-select";
import { flattenCategoryTree, useCategories } from "./product-queries";
import type { PriceBook, PriceRowFilters } from "./price-book-types";
import type { StockFilter } from "./product-types";
import { useT } from "@/lib/i18n";
import { productsNs } from "@/messages/products";

/** Nhãn: t(`filter.stockOptions.${value}`). */
const STOCK_OPTIONS: StockFilter[] = ["ALL", "BELOW_MIN", "ABOVE_MAX", "IN_STOCK", "OUT_OF_STOCK"];

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
  const t = useT(productsNs);

  return (
    <aside className="w-[200px] shrink-0 space-y-4 rounded-lg bg-background p-2.5">
      <section className="space-y-2">
        <Title action={manage && (
          <button type="button" aria-label={t("bookForm.createTitle")} title={t("bookForm.createTitle")} className="text-primary" onClick={onCreate}>
            <Plus className="size-4" />
          </button>
        )}>{t("priceBooks.books")}</Title>
        {!books.length && <p className="text-xs text-muted-foreground">{t("priceBooks.noBooks")}</p>}
        <ul className="max-h-72 space-y-0.5 overflow-y-auto">
          {books.map((b) => (
            <li key={b.id} className="group flex items-center gap-2 rounded px-1 py-1 text-[13px] hover:bg-muted">
              <Checkbox checked={selected.includes(b.id)} aria-label={b.name}
                onCheckedChange={(on) => onSelect(on ? [...selected, b.id] : selected.filter((x) => x !== b.id))} />
              <span className="min-w-0 flex-1 truncate" title={b.name}>
                {b.name}
                {(!b.active || expired(b)) && (
                  <span className="ml-1 text-xs text-muted-foreground">({expired(b) ? t("detail.expired") : t("priceBooks.inactive")})</span>
                )}
              </span>
              {manage && (
                <button type="button" aria-label={t("priceBooks.editAria", { name: b.name })} title={t("bookForm.editTitle")}
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
          {t("priceBooks.inBookOnly")}
        </label>
      </section>
      <section className="space-y-2">
        <Title>{t("fields.category")}</Title>
        <ProductFilterMultiSelect placeholder={t("filter.pickCategory")} options={flattenCategoryTree(categories)}
          value={filters.categoryIds} onChange={(categoryIds) => set({ categoryIds })} />
      </section>
      <section className="space-y-2">
        <Title>{t("fields.stock")}</Title>
        <select aria-label={t("filter.stockCriteria")} value={filters.stock} onChange={(e) => set({ stock: e.target.value })}
          className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm">
          {STOCK_OPTIONS.map((v) => <option key={v} value={v}>{t(`filter.stockOptions.${v}`)}</option>)}
        </select>
      </section>
    </aside>
  );
}
