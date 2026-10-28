"use client";

import {
  ChartPie, FileInput, FileSpreadsheet, Keyboard, LogOut, Menu, NotebookPen, ShoppingBag, SlidersHorizontal, Undo2, UserRound,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type SaleMenuAction = "ORDERS" | "RETURN" | "RECEIPT" | "IMPORT" | "SETTINGS" | "SHORTCUTS";

/** Mở trang quản trị ở tab mới để không mất giỏ hàng đang soạn. */
const openAdmin = (path: string) => window.open(path, "_blank", "noopener");

async function logout() {
  await fetch("/api/session/logout", { method: "POST" }).catch(() => undefined);
  window.location.href = "/login";
}

/** Menu ☰ góc phải thanh xanh (như KiotViet): Quản lý, Báo cáo cuối ngày, các chức năng màn bán hàng, Đăng xuất. */
export function SaleMainMenu({ userName, onAction }: { userName: string; onAction: (a: SaleMenuAction) => void }) {
  const item = "gap-3 px-3 py-2.5 text-[13px] [&_svg]:size-[18px] [&_svg]:text-[#4b5563]";
  const tile = "flex-1 justify-center gap-2.5 rounded-md px-2 py-2.5 text-[13px]";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="Menu" className="grid size-8 shrink-0 place-items-center rounded-full hover:bg-white/10 data-popup-open:bg-white/20">
        <Menu className="size-5" /></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[276px] p-1.5">
        <div className="flex items-center gap-3 px-3 py-2.5 text-[13px] font-bold"><UserRound className="size-[18px] text-[#4b5563]" />{userName}</div>
        <DropdownMenuSeparator />
        <div className="flex gap-1 py-1">
          <DropdownMenuItem className={tile} onClick={() => openAdmin("/invoices")}>
            <span className="grid size-7 place-items-center rounded-full bg-primary-tint"><FileSpreadsheet className="size-4 text-primary" /></span>Quản lý
          </DropdownMenuItem>
          <DropdownMenuItem className={`${tile} bg-[#f3f4f6]`} onClick={() => openAdmin("/reports/end-of-day")}>
            <span className="grid size-7 place-items-center rounded-full bg-[#fff1e6]"><ChartPie className="size-4 text-[#f97316]" /></span>Báo cáo cuối ngày
          </DropdownMenuItem>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem className={item} onClick={() => onAction("ORDERS")}><ShoppingBag /> Xử lý đặt hàng</DropdownMenuItem>
        <DropdownMenuItem className={item} onClick={() => onAction("RETURN")}><Undo2 /> Chọn hóa đơn trả hàng</DropdownMenuItem>
        <DropdownMenuItem className={item} onClick={() => onAction("RECEIPT")}><NotebookPen /> Lập phiếu thu</DropdownMenuItem>
        <DropdownMenuItem className={item} onClick={() => onAction("IMPORT")}><FileInput /> Import file</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className={item} onClick={() => onAction("SETTINGS")}><SlidersHorizontal /> Thiết lập &amp; Hiển thị</DropdownMenuItem>
        <DropdownMenuItem className={item} onClick={() => onAction("SHORTCUTS")}><Keyboard /> Phím tắt</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className={`${item} text-destructive [&_svg]:text-destructive`} onClick={logout}><LogOut /> Đăng xuất</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
