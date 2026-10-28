"use client";

import { CircleHelp, FileInput, FileOutput, List, Plus, Search, Settings, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { OUTLINE_BLUE_BTN, OUTLINE_GRAY_BTN } from "./purchase-list-chrome";
import { SUPPLIER_COLUMNS } from "./supplier-list-columns";

const iconBtn = "flex size-[30px] items-center justify-center rounded-md border border-[#d1d5db] bg-background hover:border-primary hover:text-primary";

type Props = {
  search: string; onSearch: (v: string) => void; filtersOpen: boolean; onToggleFilters: () => void;
  canManage: boolean; onCreate: () => void; onImport: () => void; onExport: () => void; exporting: boolean;
  columns: string[]; onColumns: (keys: string[]) => void; size: number; onSize: (n: number) => void;
};

/** Thanh công cụ NCC: tìm theo mã/tên/SĐT (+ nút ẩn/hiện bộ lọc), + Nhà cung cấp, Import file, Xuất file, chọn cột, cài đặt, trợ giúp. */
export function SupplierListToolbar(p: Props) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative w-full max-w-[400px]">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <input aria-label="Theo mã, tên, số điện thoại" placeholder="Theo mã, tên, số điện thoại" value={p.search} onChange={(e) => p.onSearch(e.target.value)}
          className="h-8 w-full rounded-md border border-[#d1d5db] bg-background pr-9 pl-8 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-primary" />
        <button type="button" aria-label={p.filtersOpen ? "Ẩn bộ lọc" : "Hiện bộ lọc"} title={p.filtersOpen ? "Ẩn bộ lọc" : "Hiện bộ lọc"}
          onClick={p.onToggleFilters} className={cn("absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-primary", p.filtersOpen && "text-primary")}>
          <SlidersHorizontal className="size-4" />
        </button>
      </div>
      <div className="ml-auto flex items-center gap-2">
        {p.canManage && <>
          <Button variant="outline" className={OUTLINE_BLUE_BTN} onClick={p.onCreate}><Plus className="size-4" /> Nhà cung cấp</Button>
          <Button variant="outline" className={OUTLINE_GRAY_BTN} onClick={p.onImport}><FileInput className="size-4" /> Import file</Button>
        </>}
        <Button variant="outline" className={OUTLINE_GRAY_BTN} disabled={p.exporting} onClick={p.onExport}><FileOutput className="size-4" /> Xuất file</Button>
        <DropdownMenu>
          <DropdownMenuTrigger aria-label="Chọn cột hiển thị" title="Chọn cột hiển thị" className={iconBtn}><List className="size-4" /></DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            {SUPPLIER_COLUMNS.map((c) => (
              <DropdownMenuCheckboxItem key={c.key} closeOnClick={false} checked={p.columns.includes(c.key)}
                onCheckedChange={(on) => p.onColumns(on ? [...p.columns, c.key] : p.columns.filter((k) => k !== c.key))}>{c.label}</DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger aria-label="Cài đặt" title="Cài đặt" className={iconBtn}><Settings className="size-4" /></DropdownMenuTrigger>
          <DropdownMenuContent className="w-48">
            <DropdownMenuLabel>Số dòng mỗi trang</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={String(p.size)} onValueChange={(v) => p.onSize(Number(v))}>
              {[15, 30, 50, 100].map((n) => <DropdownMenuRadioItem key={n} value={String(n)}>{n} dòng</DropdownMenuRadioItem>)}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger aria-label="Trợ giúp" title="Trợ giúp" className={iconBtn}><CircleHelp className="size-4" /></DropdownMenuTrigger>
          <DropdownMenuContent className="w-80 p-3 text-[12px] leading-relaxed">
            <p className="font-semibold">Quản lý nhà cung cấp</p>
            <p>Bấm vào dòng để xem chi tiết, bấm lại dòng hoặc tab đang mở để thu gọn.</p>
            <p>Thanh toán, Điều chỉnh, Chiết khấu thanh toán ở tab &quot;Nợ cần trả nhà cung cấp&quot;. Phiếu chi tự ghi vào Sổ quỹ.</p>
            <p>Đánh dấu ô chọn đầu dòng để chỉ xuất file các nhà cung cấp đã chọn.</p>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
