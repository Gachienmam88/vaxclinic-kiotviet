"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, CircleHelp, Ellipsis, FileInput, FileOutput, Plus, Search, Settings, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PickerPopover } from "@/components/ui/picker-popover";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { commonNs } from "@/messages/common";
import { salesNs } from "@/messages/sales";
import { EMPTY_SEARCH, type InvoiceSearch } from "./invoice-filter-model";
import { FILTER_FIELD, TOOLBAR_BTN } from "./invoice-list-kit";
import { InvoiceColumnPicker } from "./invoice-column-picker";
import type { InvoiceColumn } from "./invoice-list-prefs";

const ICON_BTN = "inline-flex size-[30px] items-center justify-center rounded-md border bg-background text-foreground hover:border-primary hover:text-primary";
/** "?" — hướng dẫn KiotViet: thêm mới hóa đơn từ màn hình quản lý. */
const HELP_URL = "https://www.kiotviet.vn/huong-dan-su-dung-kiotviet/retail-ban-hang/ban-hang/#2-them-moi-hoa-don-tu-man-hinh-quan-ly-4-3";

const ADVANCED = [
  ["q", "invoices.toolbar.searchCode"], ["productQ", "invoices.toolbar.searchProduct"], ["customerQ", "invoices.toolbar.searchCustomer"],
  ["noteQ", "invoices.toolbar.searchNote"],
] as const satisfies readonly (readonly [keyof InvoiceSearch, string])[];

/**
 * Toolbar danh sách Hóa đơn như KiotViet: ô "Theo mã hóa đơn" + icon tìm nâng cao, "+ Tạo mới ▾", "Import file",
 * "Xuất file ▾", "…" (Gộp đơn), chọn cột hiển thị, thiết lập đơn hàng, hướng dẫn.
 */
export function InvoiceListToolbar({ search, onSearch, onImport, onExport, onMerge, exportDisabled, shown, onToggleColumn }: {
  search: InvoiceSearch; onSearch: (s: InvoiceSearch) => void; onImport: () => void; onMerge: () => void;
  onExport: (kind: "summary" | "detail") => void; exportDisabled: boolean;
  shown: (c: InvoiceColumn) => boolean; onToggleColumn: (c: InvoiceColumn, on: boolean) => void;
}) {
  const t = useT(salesNs);
  const tc = useT(commonNs);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(search);
  const advanced = !!(search.productQ || search.customerQ || search.noteQ);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full max-w-[400px]">
        <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <input className="h-8 w-full rounded-md border bg-background pr-9 pl-8 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-primary"
          placeholder={t("invoices.toolbar.searchCode")} aria-label={t("invoices.toolbar.searchCode")} value={search.q} onChange={(e) => onSearch({ ...search, q: e.target.value })} />
        <div className="absolute top-1/2 right-1.5 -translate-y-1/2">
          <PickerPopover open={open} onOpenChange={(o) => { setOpen(o); if (o) setDraft(search); }} label={t("invoices.toolbar.advanced")} align="start"
            triggerClassName={cn("inline-flex size-6 items-center justify-center rounded hover:text-primary", advanced ? "text-primary" : "text-muted-foreground")}
            icon={<SlidersHorizontal className="size-4" />} className="w-[400px] space-y-2 p-3">
            {ADVANCED.map(([k, key], i) => (
              <input key={k} className={FILTER_FIELD} placeholder={t(key)} aria-label={t(key)} value={draft[k]} data-picker-focus={i === 0 ? "" : undefined}
                onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter") { onSearch(draft); setOpen(false); } }} />))}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" className="h-8 rounded-md px-3" onClick={() => { onSearch(EMPTY_SEARCH); setOpen(false); }}>{t("invoices.toolbar.clearFilter")}</Button>
              <Button className="h-8 rounded-md px-3" onClick={() => { onSearch(draft); setOpen(false); }}>{tc("actions.search")}</Button>
            </div>
          </PickerPopover>
        </div>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger className={cn(TOOLBAR_BTN, "inline-flex items-center gap-1 border")}><Plus className="size-4" /> {t("invoices.toolbar.create")} <ChevronDown className="size-3.5" /></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem render={<Link href="/sale?new=1" />}>{t("invoices.toolbar.newInvoice")}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <button type="button" onClick={onImport} className={cn(TOOLBAR_BTN, "inline-flex items-center gap-1 border border-border text-foreground")}>
          <FileInput className="size-4" /> {t("invoices.toolbar.import")}</button>
        <DropdownMenu>
          <DropdownMenuTrigger disabled={exportDisabled} className={cn(TOOLBAR_BTN, "inline-flex items-center gap-1 border border-border text-foreground disabled:opacity-50")}>
            <FileOutput className="size-4" /> {tc("actions.export")} <ChevronDown className="size-3.5" /></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => onExport("summary")} title={t("invoices.toolbar.exportVietnameseNote")}>{t("invoices.toolbar.exportSummary")}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onExport("detail")} title={t("invoices.toolbar.exportVietnameseNote")}>{t("invoices.toolbar.exportDetail")}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger className={ICON_BTN} aria-label={t("invoices.toolbar.more")} title={t("invoices.toolbar.more")}><Ellipsis className="size-4" /></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={onMerge}>{t("invoices.toolbar.merge")}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <InvoiceColumnPicker shown={shown} onToggle={onToggleColumn} />
        <Link href="/settings/orders" className={ICON_BTN} aria-label={t("invoices.toolbar.orderSettings")} title={t("invoices.toolbar.orderSettings")}><Settings className="size-4" /></Link>
        <a href={HELP_URL} target="_blank" rel="noopener noreferrer" className={ICON_BTN} aria-label={t("invoices.toolbar.help")} title={t("invoices.toolbar.help")}>
          <CircleHelp className="size-4" /></a>
      </div>
    </div>
  );
}
