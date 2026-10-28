"use client";

import { useEffect, useMemo, useState } from "react";
import { FileOutput, FileUp, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { OUTLINE_GRAY_BTN, PurchaseListLayout, PurchaseListPager } from "@/features/purchases/purchase-list-chrome";
import { exportPriceRowsCsv } from "@/features/products/price-book-csv";
import { PriceBookFormDialog } from "@/features/products/price-book-form-dialog";
import { PriceBookFormulaDialog } from "@/features/products/price-book-formula-dialog";
import { usePriceImport } from "@/features/products/price-book-import";
import { EMPTY_PRICE_FILTERS, usePriceBooks, usePriceRows } from "@/features/products/price-book-queries";
import { PriceBookSidebar } from "@/features/products/price-book-sidebar";
import { PriceBookTable } from "@/features/products/price-book-table";
import type { PriceBook } from "@/features/products/price-book-types";
import { useCurrentUser } from "@/lib/use-current-user";

/** Hàng hóa → Thiết lập giá: giá chung + giá theo từng bảng giá, sửa trực tiếp trên bảng. */
export default function PriceBooksPage() {
  const { can } = useCurrentUser();
  const editable = can("catalog.manage");
  const { data: books = [] } = usePriceBooks();
  const [selected, setSelected] = useState<string[]>([]);
  const [filters, setFilters] = useState(EMPTY_PRICE_FILTERS);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(15);
  const [bookDialog, setBookDialog] = useState<{ key: number; book?: PriceBook } | null>(null);
  const [formulaBook, setFormulaBook] = useState<PriceBook | null>(null);
  const priceImport = usePriceImport();

  useEffect(() => {
    const t = setTimeout(() => { setFilters((f) => ({ ...f, q: search })); setPage(0); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // Bảng giá bị xóa → bỏ khỏi danh sách đang chọn; giữ thứ tự cột theo thứ tự chọn.
  const shown = useMemo(() => selected.map((id) => books.find((b) => b.id === id)).filter((b): b is PriceBook => !!b),
    [selected, books]);
  const shownIds = shown.map((b) => b.id);
  const rowFilters = { ...filters, inBookOnly: filters.inBookOnly && shownIds.length > 0 };
  const { data, isLoading } = usePriceRows(shownIds, rowFilters, page, size);
  const pages = data ? Math.max(1, Math.ceil(data.total / size)) : 1;

  function importFile() {
    if (shown.length !== 1) return toast.error("Chọn đúng 1 bảng giá để nhập file (hoặc dùng menu trên cột bảng giá)");
    priceImport.start(shown[0]);
  }

  const toolbar = (
    <div className="flex items-center gap-2">
      <div className="relative w-full max-w-[400px]">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <input aria-label="Tìm hàng hóa" placeholder="Theo mã, tên hàng" value={search} onChange={(e) => setSearch(e.target.value)}
          className="h-8 w-full rounded-md border border-[#d1d5db] bg-background pr-2 pl-8 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-primary" />
      </div>
      <div className="ml-auto flex items-center gap-2">
        {editable && (
          <Button variant="outline" className={OUTLINE_GRAY_BTN} disabled={priceImport.isPending} onClick={importFile}
            title="CSV gồm cột Mã hàng, Giá"><FileUp className="size-4" /> Nhập file</Button>
        )}
        <Button variant="outline" className={OUTLINE_GRAY_BTN} disabled={!data?.items.length}
          onClick={() => exportPriceRowsCsv(data?.items ?? [], shown)} title="Xuất các dòng đang hiển thị ra file CSV">
          <FileOutput className="size-4" /> Xuất file
        </Button>
      </div>
    </div>
  );

  return (
    <PurchaseListLayout title="Thiết lập giá" toolbar={toolbar} sidebar={
      <PriceBookSidebar books={books} selected={selected} onSelect={(ids) => { setSelected(ids); setPage(0); }}
        onCreate={() => setBookDialog({ key: Date.now() })} onEdit={(book) => setBookDialog({ key: Date.now(), book })}
        filters={filters} onFilters={(f) => { setFilters(f); setPage(0); }} />
    }>
      <PriceBookTable data={data} isLoading={isLoading} books={shown} editable={editable}
        onFormula={setFormulaBook} onImport={priceImport.start} onEdit={(book) => setBookDialog({ key: Date.now(), book })} />
      <PurchaseListPager size={size} onSize={(n) => { setSize(n); setPage(0); }} page={page} pages={pages}
        total={data?.total ?? 0} unit="hàng hóa" onPage={setPage} />
      {bookDialog && (
        <PriceBookFormDialog key={bookDialog.key} book={bookDialog.book} onClose={() => setBookDialog(null)}
          onSaved={(b) => !bookDialog.book && setSelected((s) => [...s, b.id])} />
      )}
      {formulaBook && (
        <PriceBookFormulaDialog book={formulaBook} books={books} filters={rowFilters} total={data?.total ?? 0}
          onClose={() => setFormulaBook(null)} />
      )}
      {priceImport.element}
    </PurchaseListLayout>
  );
}
