"use client";

import { CircleHelp, Clock, Truck, Zap } from "lucide-react";
import type { DraftInvoice } from "./sale-types";

const MODES = [["QUICK", "Bán nhanh", Zap], ["NORMAL", "Bán thường", Clock], ["DELIVERY", "Bán giao hàng", Truck]] as const;

/**
 * Thanh trắng dưới cùng: chế độ Bán nhanh / Bán thường / Bán giao hàng (ẩn ở tab trả hàng; tab đặt hàng không có giao hàng)
 * + giờ cập nhật danh mục.
 */
export function SaleFooter({ mode, showModes, allowDelivery, onMode, loadedAt, onHelp }: {
  mode: DraftInvoice["mode"]; showModes: boolean; allowDelivery: boolean; onMode: (m: DraftInvoice["mode"]) => void; loadedAt: string | null;
  onHelp: () => void;
}) {
  return (
    <footer className="flex h-[46px] shrink-0 items-center gap-2 bg-background px-5 text-[13px]">
      {showModes && MODES.filter(([m]) => allowDelivery || m !== "DELIVERY").map(([m, label, Icon]) => {
        const active = mode === m;
        return (
          <button key={m} type="button" aria-pressed={active} onClick={() => onMode(m)}
            className={`relative flex h-full items-center gap-2 pr-3 font-medium ${active ? "text-primary" : "text-foreground"}`}>
            {active && <span className="absolute inset-x-0 top-0 h-0.5 bg-primary" />}
            <span className={`grid size-7 place-items-center rounded-full ${active ? "bg-primary/10" : "bg-[#eef0f3]"}`}>
              <Icon className={`size-4 ${active && m === "QUICK" ? "fill-primary" : ""}`} /></span>
            {label}
          </button>
        );
      })}
      {loadedAt && <span className="ml-auto text-xs text-muted-foreground">Danh mục cập nhật {new Date(loadedAt).toLocaleTimeString("vi-VN")}</span>}
      <button type="button" aria-label="Phím tắt" title="Phím tắt" onClick={onHelp}
        className={`grid size-6 place-items-center rounded-full bg-primary text-white hover:bg-primary/90 ${loadedAt ? "" : "ml-auto"}`}>
        <CircleHelp className="size-4" /></button>
    </footer>
  );
}
