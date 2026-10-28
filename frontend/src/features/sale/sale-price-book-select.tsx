"use client";

import { ChevronDown } from "lucide-react";
import type { CatalogPriceBook } from "@/features/products/price-book-resolver";

type Props = { options: CatalogPriceBook[]; value: string | null; onChange: (bookId: string | null) => void };

/** Ô chọn bảng giá nhỏ "Bảng giá chung ▾" cạnh ô khách hàng (như KiotViet). */
export function SalePriceBookSelect({ options, value, onChange }: Props) {
  return (
    <label className="relative flex h-[30px] max-w-[150px] shrink-0 items-center">
      <span className="sr-only">Bảng giá</span>
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} title="Bảng giá"
        className="h-full max-w-full cursor-pointer appearance-none truncate bg-transparent pr-5 text-[13px] font-medium text-primary outline-none">
        <option value="">Bảng giá chung</option>
        {options.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-0 size-4 text-[#4b5563]" />
    </label>
  );
}
