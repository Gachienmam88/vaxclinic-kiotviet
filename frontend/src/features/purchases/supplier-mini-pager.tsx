"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

const btn = "flex size-6 items-center justify-center rounded text-muted-foreground hover:text-primary disabled:pointer-events-none disabled:opacity-40";

/** Phân trang nhỏ trong tab chi tiết: |< < [trang] > >|  "1 - 5 trong 6 dòng" (KiotViet). */
export function SupplierMiniPager({ page, size, total, onPage }: { page: number; size: number; total: number; onPage: (p: number) => void }) {
  if (total <= size) return null;
  const last = Math.ceil(total / size) - 1;
  return (
    <div className="flex items-center gap-1 pt-2 text-[12px]">
      <button type="button" className={btn} aria-label="Trang đầu" disabled={page === 0} onClick={() => onPage(0)}><ChevronsLeft className="size-3.5" /></button>
      <button type="button" className={btn} aria-label="Trang trước" disabled={page === 0} onClick={() => onPage(page - 1)}><ChevronLeft className="size-3.5" /></button>
      <span className="flex h-6 min-w-9 items-center justify-center rounded border border-[#d9dbe0] px-2">{page + 1}</span>
      <button type="button" className={btn} aria-label="Trang sau" disabled={page >= last} onClick={() => onPage(page + 1)}><ChevronRight className="size-3.5" /></button>
      <button type="button" className={btn} aria-label="Trang cuối" disabled={page >= last} onClick={() => onPage(last)}><ChevronsRight className="size-3.5" /></button>
      <span className="ml-2">{page * size + 1} - {Math.min(total, (page + 1) * size)} trong {total} dòng</span>
    </div>
  );
}
