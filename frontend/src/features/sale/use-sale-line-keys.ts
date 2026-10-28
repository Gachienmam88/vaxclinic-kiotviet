"use client";

import { useState } from "react";
import { displayLines } from "./sale-cart";
import type { SaleSettings } from "./sale-settings";
import type { CartLine } from "./sale-types";

const qtyInput = (key: string) => document.getElementById(`sale-qty-${key}`) as HTMLInputElement | null;

/** Đưa con trỏ vào ô số lượng của dòng (chờ dòng mới vẽ xong). */
export function focusQty(key: string) {
  setTimeout(() => qtyInput(key)?.focus(), 0);
}

/**
 * Dòng đang chọn trong giỏ + phím tắt theo dòng: Home (sửa số lượng), ↑/↓ (tăng/giảm 1), Enter (dòng dưới), Shift (dòng trên).
 * Thứ tự dòng theo đúng thứ tự đang hiển thị (Thiết lập → Sắp xếp).
 */
export function useSaleLineKeys(lines: CartLine[], settings: SaleSettings, setLines: (fn: (l: CartLine[]) => CartLine[]) => void) {
  const [selected, setSelected] = useState<string | null>(null);
  const shown = displayLines(lines, settings).map((x) => x.line);
  const current = shown.find((l) => l.key === selected) ?? shown[0];

  const bump = (delta: number) => current && setLines((all) => all.map((l) =>
    (l.key === current.key ? { ...l, quantity: Math.max(1, l.quantity + delta) } : l)));

  const move = (delta: number) => {
    if (!current) return;
    const i = shown.findIndex((l) => l.key === current.key);
    const next = shown[Math.min(Math.max(i + delta, 0), shown.length - 1)];
    const inQty = document.activeElement?.id?.startsWith("sale-qty-");
    setSelected(next.key);
    if (inQty) focusQty(next.key);
    document.querySelector(`[data-line-key="${next.key}"]`)?.scrollIntoView({ block: "nearest" });
  };

  return {
    selected: current?.key ?? null,
    select: setSelected,
    handlers: {
      EDIT_QTY: () => current && qtyInput(current.key)?.focus(),
      QTY_UP: () => bump(1),
      QTY_DOWN: () => bump(-1),
      NEXT_LINE: () => move(1),
      PREV_LINE: () => move(-1),
    },
  };
}
