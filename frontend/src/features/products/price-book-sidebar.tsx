"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { useCurrentUser } from "@/lib/use-current-user";
import { CategoryPickerPopover } from "./category-picker-popover";
import { PriceBookChipSelect } from "./price-book-chip-select";
import {
  BASE_BOOK_ID, COMPARE_WITHS, PRICE_COMPARES, type CompareWith, type PriceBook, type PriceCompare, type PriceRowFilters,
} from "./price-book-types";
import type { StockFilter } from "./product-types";
import { useT } from "@/lib/i18n";
import { productsNs } from "@/messages/products";

/** Nhãn: t(`filter.stockOptions.${value}`). */
const STOCK_OPTIONS: StockFilter[] = ["ALL", "BELOW_MIN", "ABOVE_MAX", "IN_STOCK", "OUT_OF_STOCK"];
const SELECT = "h-8 w-full rounded-md border border-input bg-background px-2 text-[13px] outline-none focus-visible:border-primary";

type Props = {
  books: PriceBook[];
  /** Id đang chọn theo thứ tự cột; BASE_BOOK_ID = Bảng giá chung. */
  selected: string[];
  onSelect: (ids: string[]) => void;
  onCreate: () => void;
  filters: PriceRowFilters;
  onFilters: (f: PriceRowFilters) => void;
};

const Title = ({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) => (
  <div className="flex items-center justify-between"><h3 className="text-[13px] font-bold">{children}</h3>{action}</div>
);

/** Cột lọc trái kiểu KiotViet: Bảng giá (chip, Tạo mới), Nhóm hàng, Tồn kho, Giá bán (điều kiện + giá so sánh). */
export function PriceBookSidebar({ books, selected, onSelect, onCreate, filters, onFilters }: Props) {
  const { can } = useCurrentUser();
  const set = (patch: Partial<PriceRowFilters>) => onFilters({ ...filters, ...patch });
  const t = useT(productsNs);
  const options = [
    { id: BASE_BOOK_ID, name: t("formulaBase.BASE_PRICE") },
    ...books.map((b) => ({
      id: b.id, name: b.name,
      note: Date.parse(b.validTo) < Date.now() ? t("detail.expired") : !b.active ? t("priceBooks.inactive") : undefined,
    })),
  ];
  const hasBook = selected.some((id) => id !== BASE_BOOK_ID);

  return (
    <aside className="w-[200px] shrink-0 space-y-4 rounded-lg bg-background p-2.5">
      <section className="space-y-2">
        <Title action={can("catalog.manage") && (
          <button type="button" className="text-[13px] text-primary hover:underline" onClick={onCreate}>{t("priceBooks.createNew")}</button>
        )}>{t("priceBooks.books")}</Title>
        <PriceBookChipSelect options={options} value={selected} onChange={onSelect} />
        {hasBook && (
          <label className="flex items-center gap-2 text-[13px]">
            <Checkbox checked={filters.inBookOnly} onCheckedChange={(v) => set({ inBookOnly: v === true })} />
            {t("priceBooks.inBookOnly")}
          </label>
        )}
      </section>
      <section className="space-y-2">
        <Title>{t("fields.category")}</Title>
        <CategoryPickerPopover value={filters.categoryIds} onChange={(categoryIds) => set({ categoryIds })} />
      </section>
      <section className="space-y-2">
        <Title>{t("fields.stock")}</Title>
        <select aria-label={t("filter.stockCriteria")} value={filters.stock} onChange={(e) => set({ stock: e.target.value })} className={SELECT}>
          {STOCK_OPTIONS.map((v) => <option key={v} value={v}>{t(`filter.stockOptions.${v}`)}</option>)}
        </select>
      </section>
      <section className="space-y-2">
        <Title>{t("priceBooks.salePrice")}</Title>
        <select aria-label={t("priceFilter.pickOp")} value={filters.priceOp} className={SELECT}
          onChange={(e) => set({ priceOp: e.target.value as PriceCompare | "" })}>
          <option value="">{t("priceFilter.pickOp")}</option>
          {PRICE_COMPARES.map((k) => <option key={k} value={k}>{t(`priceFilter.op.${k}`)}</option>)}
        </select>
        <select aria-label={t("priceFilter.pickCompare")} value={filters.compareWith} className={SELECT}
          onChange={(e) => set({ compareWith: e.target.value as CompareWith | "" })}>
          <option value="">{t("priceFilter.pickCompare")}</option>
          {COMPARE_WITHS.map((k) => <option key={k} value={k}>{t(`formulaBase.${k}`)}</option>)}
        </select>
      </section>
    </aside>
  );
}
