"use client";

import { useEffect, useRef } from "react";
import { isTypingTarget, resolveShortcut, type SaleShortcutAction } from "./sale-shortcuts";

/**
 * Gắn phím tắt toàn màn bán hàng (1 chỗ duy nhất). Khi đang mở hộp thoại: chỉ F4 (tìm khách trong hộp thoại) chạy,
 * để F9 / F1... không thao tác lên hóa đơn phía sau.
 */
export function useSaleShortcuts(handlers: Partial<Record<SaleShortcutAction, () => void>>) {
  const ref = useRef(handlers);
  useEffect(() => { ref.current = handlers; });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const inQty = !!el?.dataset && "saleQty" in el.dataset;
      // Nút / liên kết đang focus: Enter / phím cách giữ nguyên tác dụng bấm nút → coi như đang gõ
      const onControl = el?.tagName === "BUTTON" || el?.tagName === "A";
      const action = resolveShortcut(e, { typing: isTypingTarget(el) || onControl, inQty });
      if (!action) return;
      if (document.querySelector('[role="dialog"]') && action !== "FOCUS_CUSTOMER") return;
      const run = ref.current[action];
      if (!run) return;
      e.preventDefault();
      run();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

/** F4: ô tìm khách trong hộp thoại đang mở (Lập phiếu thu) trước, rồi tới ô tìm khách của cột thanh toán. */
export function focusCustomerSearch() {
  const el = document.querySelector<HTMLInputElement>('[role="dialog"] [data-customer-search]') ?? document.getElementById("sale-customer");
  el?.focus();
}

/** F11 toàn màn hình (bật / tắt). */
export function toggleFullscreen() {
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
  else void document.documentElement.requestFullscreen?.().catch(() => undefined);
}
