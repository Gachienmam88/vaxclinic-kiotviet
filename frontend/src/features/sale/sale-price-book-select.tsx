"use client";

import { ChevronDown } from "lucide-react";
import type { CatalogPriceBook } from "@/features/products/price-book-resolver";
import { useT } from "@/lib/i18n";
import { saleNs } from "@/messages/sale";

type Props = { options: CatalogPriceBook[]; value: string | null; onChange: (bookId: string | null) => void };

/** Ô chọn bảng giá nhỏ "Bảng giá chung ▾" cạnh ô khách hàng (như KiotViet). */
export function SalePriceBookSelect({ options, value, onChange }: Props) {
  const t = useT(saleNs);
  return (
    <label className="relative flex h-[30px] max-w-[150px] shrink-0 items-center">
      <span className="sr-only">{t("priceBook.label")}</span>
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} title={t("priceBook.label")}
        className="h-full max-w-full cursor-pointer appearance-none truncate bg-transparent pr-5 text-[13px] font-medium text-primary outline-none">
        <option value="">{t("priceBook.general")}</option>
        {options.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-0 size-4 text-[#4b5563]" />
    </label>
  );
}
