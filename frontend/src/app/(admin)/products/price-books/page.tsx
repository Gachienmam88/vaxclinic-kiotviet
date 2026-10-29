"use client";

import { useEffect, useMemo, useState } from "react";
import { FileOutput, FileUp, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { OUTLINE_BLUE_BTN, OUTLINE_GRAY_BTN, PurchaseListLayout, PurchaseListPager } from "@/features/purchases/purchase-list-chrome";
import { exportPriceRowsCsv } from "@/features/products/price-book-csv";
import { PriceBookFormDialog } from "@/features/products/price-book-form-dialog";
import { PriceBookFormulaPopover, type PriceTarget } from "@/features/products/price-book-formula-popover";
import { usePriceImport } from "@/features/products/price-book-import";
import { EMPTY_PRICE_FILTERS, usePriceBooks, usePriceRows } from "@/features/products/price-book-queries";
import { PriceBookSidebar } from "@/features/products/price-book-sidebar";
import { PriceBookTable } from "@/features/products/price-book-table";
import { BASE_BOOK_ID, type PriceBook, type PriceRow } from "@/features/products/price-book-types";
import { useCurrentUser } from "@/lib/use-current-user";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { productsNs } from "@/messages/products";

/** Hàng hóa → Thiết lập giá (KiotViet): Bảng giá chung + giá theo từng bảng giá, sửa trực tiếp / theo công thức trên bảng. */
export default function PriceBooksPage() {
  const { can } = useCurrentUser();
  const editable = can("catalog.manage");
  const t = useT(productsNs);
  const tc = useT(commonNs);
  const { data: books = [] } = usePriceBooks();
  const [selected, setSelected] = useState<string[]>([BASE_BOOK_ID]);
  const [filters, setFilters] = useState(EMPTY_PRICE_FILTERS);
  const [text, setText] = useState({ q: "", code: "", name: "" });
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [bookDialog, setBookDialog] = useState<{ key: number; book?: PriceBook } | null>(null);
  const [formula, setFormula] = useState<{ target: PriceTarget; row: PriceRow; anchor: HTMLElement } | null>(null);
  const priceImport = usePriceImport();

  useEffect(() => {
    const timer = setTimeout(() => { setFilters((f) => ({ ...f, ...text })); setPage(0); }, 300);
    return () => clearTimeout(timer);
  }, [text]);

  // Cột giá theo thứ tự chip; bảng giá bị xóa thì tự rơi khỏi danh sách.
  const columns = useMemo<PriceTarget[]>(() => selected.flatMap((id) => {
    if (id === BASE_BOOK_ID) return [{ id, name: t("formulaBase.BASE_PRICE") }];
    const b = books.find((x) => x.id === id);
    return b ? [{ id: b.id, name: b.name }] : [];
  }), [selected, books, t]);
  const shown = columns.flatMap((c) => books.filter((b) => b.id === c.id));
  const shownIds = shown.map((b) => b.id);
  // Lọc "Giá bán" so sánh giá ở cột đầu tiên (Bảng giá chung khi không chọn gì / chọn Bảng giá chung trước).
  const compareBookId = columns[0] && columns[0].id !== BASE_BOOK_ID ? columns[0].id : null;
  const rowFilters = { ...filters, inBookOnly: filters.inBookOnly && shownIds.length > 0 };
  const { data, isLoading } = usePriceRows(shownIds, rowFilters, compareBookId, page, size);
  const pages = data ? Math.max(1, Math.ceil(data.total / size)) : 1;

  function importFile() {
    if (shown.length !== 1) return toast.error(t("priceBooks.importPickOne"));
    priceImport.start(shown[0]);
  }

  const toolbar = (
    <div className="flex items-center gap-2">
      <div className="relative w-full max-w-[375px]">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <input aria-label={t("list.searchAria")} placeholder={t("priceBooks.searchPlaceholder")} value={text.q}
          onChange={(e) => setText((s) => ({ ...s, q: e.target.value }))}
          className="h-8 w-full rounded-md border border-[#d1d5db] bg-background pr-2 pl-8 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-primary" />
      </div>
      <div className="ml-auto flex items-center gap-2">
        {editable && (
          <Button variant="outline" className={OUTLINE_BLUE_BTN} onClick={() => setBookDialog({ key: Date.now() })}>
            <Plus className="size-4" /> {t("priceBooks.addBook")}
          </Button>
        )}
        {editable && (
          <Button variant="outline" className={OUTLINE_GRAY_BTN} disabled={priceImport.isPending} onClick={importFile}
            title={t("priceBooks.importHint")}><FileUp className="size-4" /> Import</Button>
        )}
        <Button variant="outline" className={OUTLINE_GRAY_BTN} disabled={!data?.items.length}
          onClick={() => exportPriceRowsCsv(data?.items ?? [], shown)} title={t("priceBooks.exportHint")}>
          <FileOutput className="size-4" /> {tc("actions.export")}
        </Button>
      </div>
    </div>
  );

  return (
    <PurchaseListLayout title={columns.length ? columns.map((c) => c.name).join(", ") : t("priceBooks.title")} toolbar={toolbar} sidebar={
      <PriceBookSidebar books={books} selected={selected} onSelect={(ids) => { setSelected(ids); setPage(0); }}
        onCreate={() => setBookDialog({ key: Date.now() })} filters={filters} onFilters={(f) => { setFilters(f); setPage(0); }} />
    }>
      <PriceBookTable data={data} isLoading={isLoading} columns={columns} books={books} editable={editable}
        code={text.code} name={text.name} onCode={(code) => setText((s) => ({ ...s, code }))} onName={(name) => setText((s) => ({ ...s, name }))}
        onFormula={(target, row, anchor) => setFormula({ target, row, anchor })} onImport={priceImport.start}
        onEdit={(book) => setBookDialog({ key: Date.now(), book })} />
      <PurchaseListPager size={size} onSize={(n) => { setSize(n); setPage(0); }} page={page} pages={pages}
        total={data?.total ?? 0} unit={t("list.emptyWhat")} onPage={setPage} />
      {bookDialog && (
        <PriceBookFormDialog key={bookDialog.key} book={bookDialog.book} onClose={() => setBookDialog(null)}
          onSaved={(b) => !bookDialog.book && setSelected((s) => [...s, b.id])} />
      )}
      {formula && (
        <PriceBookFormulaPopover key={`${formula.target.id}-${formula.row.unitId}`} anchor={formula.anchor} target={formula.target}
          row={formula.row} books={books} total={data?.total ?? 0} filters={rowFilters} compareBookId={compareBookId}
          onClose={() => setFormula(null)} />
      )}
      {priceImport.element}
    </PurchaseListLayout>
  );
}
