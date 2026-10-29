"use client";

import { ChevronDown } from "lucide-react";
import { DocCodeLink } from "@/components/ui/doc-code-link";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ListEmptyRow } from "@/components/ui/list-empty-state";
import { LIST_HEADER_ROW } from "@/features/purchases/purchase-list-chrome";
import type { PageResponse } from "@/lib/api-client";
import { formatNumber } from "@/lib/format";
import type { PriceTarget } from "./price-book-formula-popover";
import { PriceBookPriceCell } from "./price-book-price-cell";
import { BASE_BOOK_ID, type PriceBook, type PriceRow } from "./price-book-types";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { productsNs } from "@/messages/products";

const FILTER_INPUT = "h-8 w-full rounded-md border border-[#d1d5db] bg-background px-2.5 text-[13px] font-normal outline-none placeholder:text-muted-foreground focus:border-primary";

type Props = {
  data: PageResponse<PriceRow> | undefined;
  isLoading: boolean;
  /** Cột giá theo thứ tự chip đang chọn; id BASE_BOOK_ID = Bảng giá chung. */
  columns: PriceTarget[];
  books: PriceBook[];
  editable: boolean;
  code: string;
  name: string;
  onCode: (v: string) => void;
  onName: (v: string) => void;
  onFormula: (target: PriceTarget, row: PriceRow, anchor: HTMLElement) => void;
  onImport: (b: PriceBook) => void;
  onEdit: (b: PriceBook) => void;
};

/** Bảng Thiết lập giá kiểu KiotViet: Mã hàng, Tên hàng, Giá vốn, Giá nhập cuối + 1 cột ô giá cho mỗi bảng giá đang chọn. */
export function PriceBookTable({ data, isLoading, columns, books, editable, code, name, onCode, onName, onFormula, onImport, onEdit }: Props) {
  const cols = 4 + columns.length;
  const t = useT(productsNs);
  const tc = useT(commonNs);
  const bookOf = (id: string) => books.find((b) => b.id === id);
  return (
    <div className="overflow-x-auto rounded-lg bg-background">
      <Table stickyHeader>
        <TableHeader>
          <TableRow className={LIST_HEADER_ROW}>
            <TableHead className="w-32 pl-2">{t("fields.code")}</TableHead>
            <TableHead>{t("fields.name")}</TableHead>
            <TableHead className="w-28 text-right">{t("fields.cost")}</TableHead>
            <TableHead className="w-28 text-right">{t("formulaBase.LAST_PURCHASE")}</TableHead>
            {columns.map((c) => {
              const book = bookOf(c.id);
              return (
                <TableHead key={c.id} className="w-32 pr-2 text-right">
                  {editable && book ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger className="ml-auto inline-flex max-w-40 items-center gap-1 outline-none">
                        <span className="truncate" title={c.name}>{c.name}</span><ChevronDown className="size-3.5 shrink-0" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => onImport(book)}>{t("priceBooks.importPrices")}</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEdit(book)}>{t("bookForm.editTitle")}</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : <span className="truncate" title={c.name}>{c.name}</span>}
                </TableHead>
              );
            })}
          </TableRow>
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-2"><input aria-label={t("priceBooks.searchCode")} placeholder={t("priceBooks.searchCode")}
              value={code} onChange={(e) => onCode(e.target.value)} className={FILTER_INPUT} /></TableHead>
            <TableHead><input aria-label={t("priceBooks.searchName")} placeholder={t("priceBooks.searchName")}
              value={name} onChange={(e) => onName(e.target.value)} className={`${FILTER_INPUT} max-w-[262px]`} /></TableHead>
            <TableHead colSpan={2 + columns.length} />
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            <TableRow><TableCell colSpan={cols} className="py-8 text-center text-muted-foreground">{tc("status.loading")}</TableCell></TableRow>
          )}
          {data && !data.items.length && <ListEmptyRow cols={cols} what={t("list.emptyWhat")} />}
          {data?.items.map((r) => (
            <TableRow key={r.unitId}>
              <TableCell className="pl-2"><DocCodeLink code={r.code} /></TableCell>
              <TableCell className="max-w-[500px] min-w-40 whitespace-normal">{r.name} ({r.unitName})</TableCell>
              <TableCell className="text-right">{formatNumber(r.cost)}</TableCell>
              <TableCell className="text-right">{r.lastPurchasePrice == null ? "0" : formatNumber(r.lastPurchasePrice)}</TableCell>
              {columns.map((c) => {
                const price = c.id === BASE_BOOK_ID ? r.basePrice : r.prices[c.id];
                return (
                  <TableCell key={c.id} className="py-1 pr-2 text-right">
                    <PriceBookPriceCell key={`${c.id}-${r.unitId}-${price ?? ""}`} bookId={c.id} unitId={r.unitId} price={price}
                      basePrice={r.basePrice} editable={editable} onFormula={(el) => onFormula(c, r, el)} />
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
