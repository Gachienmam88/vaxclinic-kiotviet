"use client";

import { useEffect, useRef } from "react";

/**
 * Phím tắt màn nhập hàng / trả hàng nhập (popover "!", ảnh 291) — chỉ những phím ứng dụng làm được:
 * F3 tìm hàng (ProductPicker tự xử lý), F4 ô tìm NCC, F8 ô tiền trả NCC, F9 Hoàn thành (hoặc Lưu khi sửa phiếu đã nhập),
 * ↑ / ↓ tăng / giảm số lượng ở ô đang đứng, Enter xuống ô số lượng dòng dưới, Shift lên ô số lượng dòng trên.
 */
export function usePurchaseEditorShortcuts(onComplete: () => void, onStepQty: (index: number, delta: number) => void) {
  const complete = useRef(onComplete);
  const step = useRef(onStepQty);
  complete.current = onComplete;
  step.current = onStepQty;

  useEffect(() => {
    const focusIn = (selector: string) => {
      const el = document.querySelector<HTMLInputElement>(selector);
      el?.focus();
      el?.select?.();
    };
    const qtyInput = (i: number) => document.querySelector<HTMLInputElement>(`input[data-qty="${i}"]`);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F4") { e.preventDefault(); focusIn("#purchase-supplier-box input"); return; }
      if (e.key === "F8") { e.preventDefault(); focusIn("#purchase-paid-box input"); return; }
      if (e.key === "F9") { e.preventDefault(); complete.current(); return; }
      const target = e.target as HTMLElement | null;
      const idx = target?.getAttribute?.("data-qty");
      if (idx == null) return;
      const i = Number(idx);
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        step.current(i, e.key === "ArrowUp" ? 1 : -1);
        (target as HTMLInputElement).blur(); // ô số đang gõ giữ chuỗi cũ → blur rồi focus lại để hiện số mới
        requestAnimationFrame(() => qtyInput(i)?.focus());
      } else if (e.key === "Enter" || (e.key === "Shift" && !e.repeat)) {
        const next = qtyInput(e.key === "Enter" ? i + 1 : i - 1);
        if (next) { e.preventDefault(); next.focus(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
