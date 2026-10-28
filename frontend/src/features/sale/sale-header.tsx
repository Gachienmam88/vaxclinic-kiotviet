"use client";

import { RefreshCw, ShoppingBag, Undo2, WifiOff } from "lucide-react";
import { AccentThemeSync } from "@/components/layout/accent-theme-sync";
import { SaleInvoiceTabs } from "./sale-invoice-tabs";
import { SaleMainMenu, type SaleMenuAction } from "./sale-main-menu";
import { SalePrintSettingsPopover } from "./sale-print-settings-popover";
import { SaleProductSearch } from "./sale-product-search";
import type { SaleTabs } from "./use-sale-tabs";
import type { CatalogProduct } from "./sale-types";

type Props = {
  products: CatalogProduct[];
  onPick: (p: CatalogProduct, unitId: string) => void;
  tabs: SaleTabs;
  online: boolean;
  pending: number;
  userName: string;
  onAction: (a: SaleMenuAction | "SYNC") => void;
};

const icon = "relative grid size-8 shrink-0 place-items-center rounded-md hover:bg-white/10";

/**
 * Thanh xanh trên cùng (như KiotViet): ô tìm hàng (F3) + chọn nhiều + quét mã, các tab, (+)▾, rồi các icon
 * Xử lý đặt hàng · Chọn hóa đơn trả hàng · Đồng bộ phiếu (số phiếu chờ / mất mạng) · Thiết lập in · tên người dùng · menu ☰.
 */
export function SaleHeader({ products, onPick, tabs, online, pending, userName, onAction }: Props) {
  return (
    <header className="flex h-[50px] shrink-0 items-center gap-2 bg-chrome pr-3 pl-1.5 text-white">
      {/* Thanh trên + nút THANH TOÁN theo màu chủ đề của người dùng (như KiotViet) */}
      <AccentThemeSync />
      <SaleProductSearch products={products} onPick={onPick} />
      <SaleInvoiceTabs tabs={tabs} />
      <div className="flex shrink-0 items-center gap-1.5 pl-2">
        <button type="button" className={icon} aria-label="Xử lý đặt hàng" title="Xử lý đặt hàng" onClick={() => onAction("ORDERS")}>
          <ShoppingBag className="size-5" /></button>
        <button type="button" className={icon} aria-label="Chọn hóa đơn trả hàng" title="Chọn hóa đơn trả hàng" onClick={() => onAction("RETURN")}>
          <Undo2 className="size-5" /></button>
        <button type="button" className={`${icon} ${!online ? "bg-orange-500 hover:bg-orange-500/90" : ""}`} onClick={() => onAction("SYNC")}
          aria-label={`Đồng bộ phiếu${pending ? ` (${pending} chờ đồng bộ)` : ""}${online ? "" : " — mất kết nối"}`}
          title={online ? `Đồng bộ phiếu${pending ? ` — ${pending} phiếu chờ` : ""}` : "Mất kết nối — phiếu lưu trên máy"}>
          {online ? <RefreshCw className="size-5" /> : <WifiOff className="size-5" />}
          {pending > 0 && <span className="absolute -top-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full bg-orange-500 px-1 text-[10px] font-bold">{pending}</span>}
        </button>
        <SalePrintSettingsPopover />
        <span className="max-w-36 truncate px-1 text-[13px] font-medium">{userName}</span>
        <SaleMainMenu userName={userName} onAction={onAction} />
      </div>
    </header>
  );
}
