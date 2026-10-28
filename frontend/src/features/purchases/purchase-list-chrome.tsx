"use client";

import Link from "next/link";
import { FileOutput, Inbox, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Hàng tiêu đề bảng danh sách: nền xanh nhạt kiểu KiotViet. */
export const LIST_HEADER_ROW = "bg-[#e3f0fc] hover:bg-[#e3f0fc]";
/** Nút viền xanh ("+ Nhập hàng", "+ Trả hàng nhập"...). */
export const OUTLINE_BLUE_BTN = "h-[30px] rounded-md border-primary bg-background px-3 text-primary hover:bg-primary/5 hover:text-primary";
/** Nút viền xám ("Xuất file", "Sao chép"...). */
export const OUTLINE_GRAY_BTN = "h-[30px] rounded-md border-[#d1d5db] bg-background px-3";

/**
 * Khung trang danh sách Mua hàng: cột trái 200px (tiêu đề + bộ lọc), cột phải (thanh công cụ + bảng).
 * Không có sidebar → bảng chiếm toàn bộ chiều ngang, tiêu đề vẫn giữ cột 200px cho thẳng hàng.
 */
export function PurchaseListLayout({ title, toolbar, sidebar, children }: {
  title: string; toolbar: React.ReactNode; sidebar?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[200px_minmax(0,1fr)] gap-x-2.5 gap-y-2.5">
      <h1 className="self-center text-lg font-bold">{title}</h1>
      <div>{toolbar}</div>
      {sidebar && <div className="self-start">{sidebar}</div>}
      <div className={cn("min-w-0 space-y-2", !sidebar && "col-span-2")}>{children}</div>
    </div>
  );
}

/** Ô tìm kiếm 400px + nút tạo mới viền xanh + "Xuất file" (CSV của trang đang xem). */
export function PurchaseListToolbar({ search, onSearch, placeholder, createLabel, createHref, onCreate, onExport }: {
  search: string; onSearch: (v: string) => void; placeholder: string;
  createLabel?: string; createHref?: string; onCreate?: () => void; onExport?: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative w-full max-w-[400px]">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <input aria-label={placeholder} placeholder={placeholder} value={search} onChange={(e) => onSearch(e.target.value)}
          className="h-8 w-full rounded-md border border-[#d1d5db] bg-background pr-2 pl-8 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-primary" />
      </div>
      <div className="ml-auto flex items-center gap-2">
        {createLabel && createHref && (
          <Button variant="outline" className={OUTLINE_BLUE_BTN} render={<Link href={createHref} />}>
            <Plus className="size-4" /> {createLabel}
          </Button>
        )}
        {createLabel && onCreate && (
          <Button variant="outline" className={OUTLINE_BLUE_BTN} onClick={onCreate}><Plus className="size-4" /> {createLabel}</Button>
        )}
        {onExport && (
          <Button variant="outline" className={OUTLINE_GRAY_BTN} onClick={onExport}><FileOutput className="size-4" /> Xuất file</Button>
        )}
      </div>
    </div>
  );
}

/** Chân bảng: "Hiển thị [15 dòng]" bên trái, phân trang bên phải. */
export function PurchaseListPager({ size, onSize, page, pages, total, unit, onPage }: {
  size: number; onSize: (n: number) => void; page: number; pages: number; total: number; unit: string;
  onPage: (p: number) => void;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span>Hiển thị</span>
      <select aria-label="Số dòng mỗi trang" className="h-6 rounded border border-[#d1d5db] bg-background px-1.5" value={size}
        onChange={(e) => onSize(Number(e.target.value))}>
        {[15, 30, 50, 100].map((n) => <option key={n} value={n}>{n} dòng</option>)}
      </select>
      <span className="ml-auto text-muted-foreground">{total} {unit} — trang {page + 1}/{pages}</span>
      <Button size="xs" variant="outline" disabled={page === 0} onClick={() => onPage(page - 1)}>Trước</Button>
      <Button size="xs" variant="outline" disabled={page + 1 >= pages} onClick={() => onPage(page + 1)}>Sau</Button>
    </div>
  );
}

/** Trạng thái rỗng chứng từ mua hàng (dùng khung chung ListEmptyState). onWiden: mở rộng tìm ra mọi thời gian. */
export function PurchaseEmptyState({ onWiden }: { onWiden?: () => void }) {
  return <ListEmptyState onWiden={onWiden} />;
}

/** DocStatus của chứng từ mua hàng / xuất kho; BALANCED = "Đã cân bằng kho" (kiểm kho). */
const STATUS_TONE: Record<string, string> = {
  DRAFT: "bg-[#fff4e5] text-[#e07b00]",
  COMPLETED: "bg-[#e6f6ec] text-[#0d9f4f]",
  BALANCED: "bg-[#e6f6ec] text-[#0d9f4f]",
  CANCELLED: "bg-[#fdecec] text-[#d92d20]",
};

/** Nhãn trạng thái chữ màu trên nền nhạt (VD "Đã nhập hàng" xanh lá). */
export function DocStatusBadge({ status, label }: { status: string; label: string }) {
  return <span className={cn("inline-flex h-5 items-center rounded px-1.5 text-xs font-medium whitespace-nowrap", STATUS_TONE[status])}>{label}</span>;
}
