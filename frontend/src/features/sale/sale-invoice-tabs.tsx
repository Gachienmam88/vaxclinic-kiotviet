"use client";

import { useEffect, useRef } from "react";
import { ArrowLeftRight, ChevronDown, ChevronLeft, ChevronRight, CirclePlus, X } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SaleTabs } from "./use-sale-tabs";

/**
 * Dải tab hóa đơn trên thanh xanh: tab đang chọn nền trắng, tab khác chữ trắng; mũi tên cuộn khi nhiều tab.
 * Nút (+) thêm hóa đơn (F1), ▾ → Thêm hóa đơn / Thêm đặt hàng (như KiotViet). Tab đang chọn có icon ⇄.
 */
export function SaleInvoiceTabs({ tabs }: { tabs: SaleTabs }) {
  const strip = useRef<HTMLDivElement>(null);
  const activeId = tabs.active?.id;

  // Tab đang chọn luôn nằm trong vùng nhìn thấy (mở tab sửa / trả hàng từ trang quản lý)
  useEffect(() => {
    strip.current?.querySelector("[data-active=true]")?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeId, tabs.tabs.length]);

  const scroll = (dx: number) => strip.current?.scrollBy({ left: dx, behavior: "smooth" });
  const arrow = "grid h-full w-6 shrink-0 place-items-center text-white/90 hover:text-white";

  return (
    <div className="flex h-[42px] min-w-0 flex-1 items-end self-end">
      <button type="button" aria-label="Cuộn tab sang trái" className={arrow} onClick={() => scroll(-240)}><ChevronLeft className="size-5" /></button>
      <div ref={strip} role="tablist" aria-label="Hóa đơn đang soạn" className="flex h-full min-w-0 items-end overflow-x-hidden">
        {tabs.tabs.map((t) => {
          const active = t.id === activeId;
          return (
            <div key={t.id} data-active={active}
              className={`flex h-full shrink-0 items-center gap-3 rounded-t-lg pr-2.5 pl-3 text-[13px] font-bold ${
                active ? "bg-background text-foreground" : "text-white hover:bg-white/10"}`}>
              <button type="button" role="tab" aria-selected={active} className="flex max-w-44 items-center gap-2 truncate" onClick={() => tabs.setActiveId(t.id)}>
                {active && <ArrowLeftRight className="size-4 shrink-0 text-chrome" />}<span className="truncate">{t.label}</span></button>
              <button type="button" aria-label={`Đóng ${t.label}`} className={active ? "text-muted-foreground hover:text-foreground" : "text-white/90 hover:text-white"}
                onClick={() => (t.lines.length === 0 || confirm(`Đóng ${t.label}? Giỏ hàng sẽ bị xóa.`)) && tabs.close(t.id)}>
                <X className="size-4" /></button>
            </div>
          );
        })}
      </div>
      <button type="button" aria-label="Cuộn tab sang phải" className={arrow} onClick={() => scroll(240)}><ChevronRight className="size-5" /></button>
      <button type="button" aria-label="Thêm hóa đơn" title="Thêm hóa đơn (F1)" className="grid h-full w-8 shrink-0 place-items-center text-white hover:bg-white/10"
        onClick={() => tabs.add()}><CirclePlus className="size-5" /></button>
      <DropdownMenu>
        <DropdownMenuTrigger aria-label="Thêm hóa đơn / đặt hàng" className="grid h-full w-5 shrink-0 place-items-center text-white hover:bg-white/10">
          <ChevronDown className="size-4 fill-white" /></DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48 p-1.5">
          <DropdownMenuItem className="py-2 text-[13px]" onClick={() => tabs.add()}>Thêm hóa đơn</DropdownMenuItem>
          <DropdownMenuItem className="py-2 text-[13px]" onClick={() => tabs.add("ORDER")}>Thêm đặt hàng</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
