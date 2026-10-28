"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Columns3, FileOutput, Plus, Search, Settings, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PickerPopover } from "@/components/ui/picker-popover";
import { cn } from "@/lib/utils";
import { EMPTY_SEARCH, type InvoiceSearch } from "./invoice-filter-model";
import { FILTER_FIELD, TOOLBAR_BTN } from "./invoice-list-kit";
import { INVOICE_COLUMNS, type InvoiceColumn } from "./invoice-list-prefs";

const ICON_BTN = "inline-flex size-[30px] items-center justify-center rounded-md border bg-background text-foreground hover:border-primary hover:text-primary";

const ADVANCED: readonly (readonly [keyof InvoiceSearch, string])[] = [
  ["q", "Theo mã hóa đơn"], ["productQ", "Theo mã, tên hàng"], ["customerQ", "Theo mã, tên, SĐT khách hàng"], ["noteQ", "Theo ghi chú"],
];

/**
 * Toolbar danh sách Hóa đơn như KiotViet: ô "Theo mã hóa đơn" + icon tìm nâng cao, "+ Tạo mới ▾", "Xuất file ▾",
 * chọn cột hiển thị, thiết lập đơn hàng.
 */
export function InvoiceListToolbar({ search, onSearch, onExport, exportDisabled, shown, onToggleColumn }: {
  search: InvoiceSearch; onSearch: (s: InvoiceSearch) => void;
  onExport: (kind: "summary" | "detail") => void; exportDisabled: boolean;
  shown: (c: InvoiceColumn) => boolean; onToggleColumn: (c: InvoiceColumn, on: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(search);
  const advanced = !!(search.productQ || search.customerQ || search.noteQ);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full max-w-[400px]">
        <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <input className="h-8 w-full rounded-md border bg-background pr-9 pl-8 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-primary"
          placeholder="Theo mã hóa đơn" aria-label="Theo mã hóa đơn" value={search.q} onChange={(e) => onSearch({ ...search, q: e.target.value })} />
        <div className="absolute top-1/2 right-1.5 -translate-y-1/2">
          <PickerPopover open={open} onOpenChange={(o) => { setOpen(o); if (o) setDraft(search); }} label="Tìm kiếm nâng cao" align="start"
            triggerClassName={cn("inline-flex size-6 items-center justify-center rounded hover:text-primary", advanced ? "text-primary" : "text-muted-foreground")}
            icon={<SlidersHorizontal className="size-4" />} className="w-[400px] space-y-2 p-3">
            {ADVANCED.map(([k, label], i) => (
              <input key={k} className={FILTER_FIELD} placeholder={label} aria-label={label} value={draft[k]} data-picker-focus={i === 0 ? "" : undefined}
                onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter") { onSearch(draft); setOpen(false); } }} />))}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" className="h-8 rounded-md px-3" onClick={() => { onSearch(EMPTY_SEARCH); setOpen(false); }}>Xóa lọc</Button>
              <Button className="h-8 rounded-md px-3" onClick={() => { onSearch(draft); setOpen(false); }}>Tìm kiếm</Button>
            </div>
          </PickerPopover>
        </div>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger className={cn(TOOLBAR_BTN, "inline-flex items-center gap-1 border")}><Plus className="size-4" /> Tạo mới <ChevronDown className="size-3.5" /></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem render={<Link href="/pos" />}>Hóa đơn</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger disabled={exportDisabled} className={cn(TOOLBAR_BTN, "inline-flex items-center gap-1 border disabled:opacity-50")}>
            <FileOutput className="size-4" /> Xuất file <ChevronDown className="size-3.5" /></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onExport("summary")}>Xuất file tổng quan</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onExport("detail")}>Xuất file chi tiết</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger className={ICON_BTN} aria-label="Chọn cột hiển thị" title="Chọn cột hiển thị"><Columns3 className="size-4" /></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {INVOICE_COLUMNS.map(([k, label]) => (
              <DropdownMenuCheckboxItem key={k} checked={shown(k)} closeOnClick={false} onCheckedChange={(on) => onToggleColumn(k, on)}>{label}</DropdownMenuCheckboxItem>))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Link href="/settings/orders" className={ICON_BTN} aria-label="Thiết lập đơn hàng" title="Thiết lập đơn hàng"><Settings className="size-4" /></Link>
      </div>
    </div>
  );
}
