"use client";

import { ChevronDown } from "lucide-react";
import { DocCodeLink } from "@/components/ui/doc-code-link";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ListEmptyRow } from "@/components/ui/list-empty-state";
import { LIST_HEADER_ROW } from "@/features/purchases/purchase-list-chrome";
import type { PageResponse } from "@/lib/api-client";
import { formatMoney, formatNumber } from "@/lib/format";
import { PriceBookPriceCell } from "./price-book-price-cell";
import type { PriceBook, PriceRow } from "./price-book-types";

type Props = {
  data: PageResponse<PriceRow> | undefined;
  isLoading: boolean;
  books: PriceBook[]; // các bảng giá đang chọn = các cột giá
  editable: boolean;
  onFormula: (b: PriceBook) => void;
  onImport: (b: PriceBook) => void;
  onEdit: (b: PriceBook) => void;
};

/** Bảng Thiết lập giá: Mã hàng, Tên hàng, Giá vốn, Giá nhập cuối, Giá chung + 1 cột sửa giá cho mỗi bảng giá đang chọn. */
export function PriceBookTable({ data, isLoading, books, editable, onFormula, onImport, onEdit }: Props) {
  const cols = 5 + books.length;
  return (
    <div className="overflow-x-auto rounded-lg bg-background">
      <Table>
        <TableHeader>
          <TableRow className={LIST_HEADER_ROW}>
            <TableHead className="w-28 pl-4">Mã hàng</TableHead>
            <TableHead>Tên hàng</TableHead>
            <TableHead className="text-right">Giá vốn</TableHead>
            <TableHead className="text-right">Giá nhập cuối</TableHead>
            <TableHead className="text-right">Giá chung</TableHead>
            {books.map((b) => (
              <TableHead key={b.id} className="pr-4 text-right">
                {editable ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger className="ml-auto inline-flex max-w-40 items-center gap-1 font-medium text-primary outline-none">
                      <span className="truncate" title={b.name}>{b.name}</span><ChevronDown className="size-3.5 shrink-0" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => onFormula(b)}>Áp dụng công thức</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onImport(b)}>Nhập file giá</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onEdit(b)}>Sửa bảng giá</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : <span className="truncate" title={b.name}>{b.name}</span>}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            <TableRow><TableCell colSpan={cols} className="py-8 text-center text-muted-foreground">Đang tải...</TableCell></TableRow>
          )}
          {data && !data.items.length && <ListEmptyRow cols={cols} what="hàng hóa" />}
          {data?.items.map((r) => (
            <TableRow key={r.unitId}>
              <TableCell className="pl-4"><DocCodeLink code={r.code} /></TableCell>
              <TableCell className="max-w-60 min-w-40 whitespace-normal">
                {r.name} <span className="text-muted-foreground">({r.unitName})</span>
              </TableCell>
              <TableCell className="text-right">{formatNumber(r.cost)}</TableCell>
              <TableCell className="text-right">{r.lastPurchasePrice == null ? "" : formatMoney(r.lastPurchasePrice)}</TableCell>
              <TableCell className="text-right">{formatMoney(r.basePrice)}</TableCell>
              {books.map((b) => (
                <TableCell key={b.id} className="py-1 pr-3 text-right">
                  <PriceBookPriceCell key={`${b.id}-${r.unitId}-${r.prices[b.id] ?? ""}`} bookId={b.id} unitId={r.unitId}
                    price={r.prices[b.id]} basePrice={r.basePrice} editable={editable} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
